import { randomUUID } from "node:crypto";
import mime from "mime-types";
import type { Project } from "@prisma/client";
import type { FileKind } from "@pixelhub/types";
import type {
  ConfirmFileInput,
  IngestFilesInput,
  ListFilesQuery,
  UploadUrlInput,
} from "@pixelhub/types/contracts/files";
import { emit } from "../../activity";
import { AppError } from "../../errors";
import { blobKey, presignGet, presignPut } from "../../storage";
import { ALL_ROLES, EDITORS, requireRole } from "../../auth/permissions";
import { matchFile } from "../requirements/matcher";
import { enqueueAiJob } from "../ai/queue";
import * as repo from "./repo";

export interface FileActor {
  userId: string | null;
  watcherDeviceId: string | null;
}

function baseName(input: string): string {
  const parts = input.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? input;
}

function extensionOf(input: string): string {
  const name = baseName(input);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function mimeFor(fileName: string): string {
  return mime.lookup(fileName) || "application/octet-stream";
}

function inferKind(input: string): FileKind {
  const path = input.replace(/\\/g, "/");
  if (path.startsWith("exports/")) return "EXPORT";
  if (path.startsWith("deliverables/")) return "DELIVERABLE";
  if (path.startsWith("source/") || path.startsWith("src/")) return "SOURCE";
  if (path.startsWith("references/") || path.startsWith("moodboard/")) return "REFERENCE";
  return "OTHER";
}

export async function ingestFiles(
  project: Project,
  input: IngestFilesInput,
  actor: FileActor,
) {
  const branchId = project.defaultBranchId;
  const uploadUrls: Array<{
    path: string;
    sha256: string;
    storageKey: string;
    uploadUrl: string;
  }> = [];
  const requested = new Set<string>();
  let processed = 0;

  for (const event of input.events) {
    if (event.type === "created" || event.type === "modified") {
      const path = event.path ?? event.to;
      if (!path) continue;

      const fileName = baseName(path);
      const extension = extensionOf(path);
      const mimeType = mimeFor(fileName);
      const kind = inferKind(path);
      const sha256 = event.sha256 ?? "";

      const existing = await repo.findLiveFileByPath(project.id, branchId, path);
      if (existing) await repo.softDeleteFile(existing.id);

      const hasBlob =
        sha256.length > 0 &&
        (await repo.countFilesBySha256(project.id, sha256)) > 0;
      const storageKey = sha256
        ? blobKey(sha256)
        : `uploads/${project.id}/${randomUUID()}/${fileName}`;

      const file = await repo.createFile({
        projectId: project.id,
        branchId,
        path,
        fileName,
        extension,
        mimeType,
        sizeBytes: BigInt(event.size ?? 0),
        sha256,
        storageKey,
        uploadedById: actor.userId,
        watcherDeviceId: actor.watcherDeviceId,
        kind,
      });

      if (sha256 && !hasBlob && !requested.has(sha256)) {
        requested.add(sha256);
        uploadUrls.push({
          path,
          sha256,
          storageKey,
          uploadUrl: await presignPut(storageKey, mimeType),
        });
      }

      await matchFile({
        id: file.id,
        projectId: file.projectId,
        path,
        fileName,
        branchId: file.branchId,
      });

      await emit({
        projectId: project.id,
        actorId: actor.userId,
        type: event.type === "created" ? "file.created" : "file.modified",
        entityType: "File",
        entityId: file.id,
        meta: { path, kind, sha256 },
      });
      processed += 1;
    } else if (event.type === "deleted") {
      if (!event.path) continue;
      const existing = await repo.findLiveFileByPath(project.id, branchId, event.path);
      if (!existing) continue;

      await repo.softDeleteFile(existing.id);
      await emit({
        projectId: project.id,
        actorId: actor.userId,
        type: "file.deleted",
        entityType: "File",
        entityId: existing.id,
        meta: { path: existing.path },
      });
      processed += 1;
    } else {
      const to = event.to ?? event.path;
      if (!to) continue;

      let file = event.sha256
        ? await repo.findFileBySha256(project.id, event.sha256)
        : null;
      if (!file && event.from) {
        file = await repo.findLiveFileByPath(project.id, branchId, event.from);
      }
      if (!file) continue;

      const from = event.from ?? file.path;
      const fileName = baseName(to);
      const extension = extensionOf(to);
      await repo.updateFileLocation(file.id, { path: to, fileName, extension });

      await emit({
        projectId: project.id,
        actorId: actor.userId,
        type: "file.moved",
        entityType: "File",
        entityId: file.id,
        meta: { from, to },
      });
      processed += 1;
    }
  }

  return { uploadUrls, processed };
}

export async function createUploadUrl(project: Project, input: UploadUrlInput) {
  const key = input.sha256
    ? blobKey(input.sha256)
    : `uploads/${project.id}/${randomUUID()}/${input.fileName}`;
  const uploadUrl = await presignPut(key, input.contentType);
  return { uploadUrl, storageKey: key, key };
}

export async function confirmFile(
  project: Project,
  input: ConfirmFileInput,
  actor: FileActor,
) {
  const branchId = input.branchId ?? project.defaultBranchId;
  const kind = input.kind ?? inferKind(input.path);

  const existing = await repo.findLiveFileByPath(project.id, branchId, input.path);
  if (existing) await repo.softDeleteFile(existing.id);

  const file = await repo.createFile({
    projectId: project.id,
    branchId,
    path: input.path,
    fileName: input.fileName,
    extension: input.extension,
    mimeType: input.mimeType,
    sizeBytes: BigInt(input.sizeBytes),
    sha256: input.sha256,
    storageKey: input.storageKey ?? blobKey(input.sha256),
    uploadedById: actor.userId,
    watcherDeviceId: actor.watcherDeviceId,
    kind,
  });

  const brandKit = await repo.findBrandKit(project.id);
  if (brandKit && (kind === "EXPORT" || kind === "DELIVERABLE")) {
    await enqueueAiJob({
      projectId: project.id,
      type: "BRAND_CHECK",
      input: { fileId: file.id },
      requestedById: actor.userId,
    });
  }

  await matchFile({
    id: file.id,
    projectId: file.projectId,
    path: input.path,
    fileName: input.fileName,
    branchId: file.branchId,
  });

  await emit({
    projectId: project.id,
    actorId: actor.userId,
    type: "file.confirmed",
    entityType: "File",
    entityId: file.id,
    meta: { path: input.path, kind, sha256: input.sha256 },
  });

  return file;
}

export async function listFiles(project: Project, query: ListFilesQuery) {
  const result = await repo.listFiles(project.id, query);
  return {
    items: result.items.map(({ _count, ...file }) => ({
      ...file,
      linkedRequirementCount: _count.requirementLinks,
    })),
    nextCursor: result.nextCursor,
  };
}

export async function getFile(userId: string, fileId: string) {
  const file = await repo.findFileDetailById(fileId);
  if (!file || file.deletedAt) throw AppError.notFound("File");

  await requireRole(userId, file.projectId, ALL_ROLES);

  const { requirementLinks, brandCheckResults, ...rest } = file;
  return {
    ...rest,
    linkedRequirements: requirementLinks.map((link) => ({
      ...link.requirement,
      linkType: link.linkType,
      matchedBy: link.matchedBy,
      confidence: link.confidence,
    })),
    latestBrandCheck: brandCheckResults[0] ?? null,
  };
}

export async function deleteFile(userId: string, fileId: string) {
  const file = await repo.findFileById(fileId);
  if (!file || file.deletedAt) throw AppError.notFound("File");

  await requireRole(userId, file.projectId, EDITORS);
  await repo.softDeleteFile(file.id);

  await emit({
    projectId: file.projectId,
    actorId: userId,
    type: "file.deleted",
    entityType: "File",
    entityId: file.id,
    meta: { path: file.path },
  });

  return { ok: true };
}

export async function getDownloadUrl(userId: string, fileId: string) {
  const file = await repo.findFileById(fileId);
  if (!file || file.deletedAt) throw AppError.notFound("File");

  await requireRole(userId, file.projectId, ALL_ROLES);
  const url = await presignGet(file.storageKey);
  return { url };
}

export async function recheckBrand(userId: string, fileId: string) {
  const file = await repo.findFileById(fileId);
  if (!file || file.deletedAt) throw AppError.notFound("File");

  await requireRole(userId, file.projectId, EDITORS);
  const job = await enqueueAiJob({
    projectId: file.projectId,
    type: "BRAND_CHECK",
    input: { fileId: file.id },
    requestedById: userId,
  });
  return { jobId: job.id };
}
