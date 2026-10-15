import type { Prisma } from "@prisma/client";
import type { CreateCommentInput } from "@pixelhub/types/contracts/comments";
import { emit } from "../../activity";
import { prisma } from "../../db";
import { AppError } from "../../errors";
import {
  ALL_ROLES,
  EDITORS,
  authorizeProject,
  requireRole,
} from "../../auth/permissions";
import * as repo from "./repo";
import * as taskRepo from "../tasks/repo";

type CommentRow = Awaited<ReturnType<typeof repo.findCommentsForVersion>>[number];

type CommentNode = CommentRow & { replies: CommentNode[] };

function buildThread(rows: CommentRow[]): CommentNode[] {
  const repliesByParent = new Map<string, CommentRow[]>();

  for (const row of rows) {
    if (!row.parentCommentId) continue;
    const siblings = repliesByParent.get(row.parentCommentId);
    if (siblings) siblings.push(row);
    else repliesByParent.set(row.parentCommentId, [row]);
  }

  const attach = (row: CommentRow): CommentNode => ({
    ...row,
    replies: (repliesByParent.get(row.id) ?? []).map(attach),
  });

  return rows.filter((row) => !row.parentCommentId).map(attach);
}

async function resolveTargetProject(input: CreateCommentInput): Promise<string> {
  let versionProjectId: string | null = null;
  let fileProjectId: string | null = null;

  if (input.versionId) {
    const version = await repo.findVersionWithProject(input.versionId);
    if (!version) throw AppError.notFound("Version");
    versionProjectId = version.branch.projectId;
  }

  if (input.fileId) {
    const file = await repo.findFile(input.fileId);
    if (!file) throw AppError.notFound("File");
    fileProjectId = file.projectId;
  }

  if (versionProjectId && fileProjectId && versionProjectId !== fileProjectId) {
    throw AppError.badRequest(
      "COMMENT_TARGET_MISMATCH",
      "Version and file belong to different projects",
    );
  }

  const projectId = versionProjectId ?? fileProjectId;
  if (!projectId) {
    throw AppError.badRequest(
      "COMMENT_TARGET_REQUIRED",
      "A versionId or fileId is required",
    );
  }

  return projectId;
}

export async function listVersionComments(userId: string, versionId: string) {
  const version = await repo.findVersionWithProject(versionId);
  if (!version) throw AppError.notFound("Version");

  await requireRole(userId, version.branch.projectId, ALL_ROLES);

  const rows = await repo.findCommentsForVersion(versionId);
  return buildThread(rows);
}

export async function listFileComments(userId: string, fileId: string) {
  const file = await repo.findFile(fileId);
  if (!file) throw AppError.notFound("File");

  const membership = await requireRole(userId, file.projectId, ALL_ROLES);
  if (!membership.canViewFiles) {
    throw AppError.forbidden(
      "FILE_VIEW_RESTRICTED",
      "File viewing is restricted for your role",
    );
  }

  const rows = await repo.findCommentsForFile(fileId);
  return buildThread(rows);
}

export async function listProjectComments(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  const rows = await repo.findCommentsForProject(project.id);
  return buildThread(rows);
}

export async function createComment(
  userId: string,
  input: CreateCommentInput,
) {
  const projectId = await resolveTargetProject(input);
  const membership = await requireRole(userId, projectId, ALL_ROLES);
  if (!membership.canComment) {
    throw AppError.forbidden(
      "COMMENT_RESTRICTED",
      "Commenting is restricted for your role on this project",
    );
  }

  if (input.parentCommentId) {
    const parent = await repo.findParentComment(input.parentCommentId);
    if (!parent) throw AppError.notFound("Comment");
    if (parent.projectId !== projectId) {
      throw AppError.badRequest(
        "COMMENT_PARENT_MISMATCH",
        "Parent comment belongs to a different project",
      );
    }
  }

  const anchorJson =
    input.anchor == null ? undefined : (input.anchor as Prisma.InputJsonValue);

  const comment = await repo.createComment({
    projectId,
    versionId: input.versionId ?? null,
    fileId: input.fileId ?? null,
    parentCommentId: input.parentCommentId ?? null,
    authorId: userId,
    body: input.body,
    anchorJson,
    status: "OPEN",
  });

  await emit({
    projectId,
    actorId: userId,
    type: "comment.created",
    entityType: "Comment",
    entityId: comment.id,
    meta: {
      versionId: comment.versionId,
      fileId: comment.fileId,
      parentCommentId: comment.parentCommentId,
    },
  });

  return comment;
}

export async function resolveComment(userId: string, commentId: string) {
  const comment = await repo.findComment(commentId);
  if (!comment) throw AppError.notFound("Comment");

  await requireRole(userId, comment.projectId, ALL_ROLES);

  const updated = await repo.updateComment(comment.id, { status: "RESOLVED" });

  await emit({
    projectId: comment.projectId,
    actorId: userId,
    type: "comment.resolved",
    entityType: "Comment",
    entityId: comment.id,
  });

  return updated;
}

export async function convertCommentToTask(
  userId: string,
  commentId: string,
) {
  const comment = await repo.findComment(commentId);
  if (!comment) throw AppError.notFound("Comment");

  await requireRole(userId, comment.projectId, EDITORS);

  const task = await prisma.$transaction(async (tx) => {
    const created = await taskRepo.createTask(
      {
        projectId: comment.projectId,
        title: comment.body.slice(0, 120),
        description: comment.body,
        source: "COMMENT",
        status: "TODO",
        commentId: comment.id,
      },
      tx,
    );

    await repo.updateComment(comment.id, { convertedTaskId: created.id }, tx);
    return created;
  });

  await emit({
    projectId: comment.projectId,
    actorId: userId,
    type: "comment.converted_to_task",
    entityType: "Task",
    entityId: task.id,
    meta: { commentId: comment.id },
  });

  return task;
}
