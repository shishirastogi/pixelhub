import type { Prisma } from "@prisma/client";
import type {
  CreateBranchInput,
  MergeBranchInput,
  UpdateBranchInput,
} from "@pixelhub/types/contracts/branches";
import { emit } from "../../activity";
import { prisma, type Db } from "../../db";
import { AppError } from "../../errors";
import { slugify } from "../../slug";
import {
  ALL_ROLES,
  EDITORS,
  authorizeProject,
  requireRole,
} from "../../auth/permissions";
import { computeChecksum } from "../versions/checksum";
import * as versionRepo from "../versions/repo";
import * as repo from "./repo";

async function uniqueBranchSlug(
  projectId: string,
  name: string,
  db: Db,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (await repo.branchSlugExists(projectId, candidate, db, excludeId)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

async function getBranchDetail(branchId: string) {
  const branch = await repo.findBranchDetail(branchId);
  if (!branch) throw AppError.notFound("Branch");
  return { ...branch, fileCount: branch._count.files, _count: undefined };
}

export async function listBranches(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  const branches = await repo.findBranches(project.id);
  return branches.map((branch) => ({
    ...branch,
    fileCount: branch._count.files,
    _count: undefined,
  }));
}

export async function createBranch(
  userId: string,
  idOrSlug: string,
  input: CreateBranchInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);

  const branchId = await prisma.$transaction(async (tx) => {
    const slug = await uniqueBranchSlug(project.id, input.name, tx);
    const parentBranchId = input.fromBranchId ?? project.defaultBranchId ?? null;

    let sourceHead: Awaited<ReturnType<typeof versionRepo.findVersionWithFiles>> = null;
    if (parentBranchId) {
      const source = await repo.findBranchInProject(parentBranchId, project.id, tx);
      if (!source) throw AppError.notFound("Branch");
      if (source.headVersionId) {
        sourceHead = await versionRepo.findVersionWithFiles(source.headVersionId, tx);
      }
    }

    const branch = await repo.createBranch(
      {
        projectId: project.id,
        name: input.name.trim(),
        slug,
        kind: input.kind,
        parentBranchId,
      },
      tx,
    );

    if (sourceHead) {
      const version = await versionRepo.createVersion(
        {
          branchId: branch.id,
          number: 1,
          label: "Branch start",
          createdById: userId,
          checksum: sourceHead.checksum,
          parentVersionId: sourceHead.id,
          files: sourceHead.files.map((file) => ({
            fileId: file.fileId,
            path: file.path,
            role: file.role,
          })),
        },
        tx,
      );
      await versionRepo.setBranchHead(branch.id, version.id, tx);
    }

    await emit(
      {
        projectId: project.id,
        actorId: userId,
        type: "branch.created",
        entityType: "Branch",
        entityId: branch.id,
        meta: {
          name: branch.name,
          kind: branch.kind,
          fromBranchId: parentBranchId,
        },
      },
      tx,
    );

    return branch.id;
  });

  return getBranchDetail(branchId);
}

export async function updateBranch(
  userId: string,
  branchId: string,
  input: UpdateBranchInput,
) {
  const branch = await repo.findBranch(branchId);
  if (!branch || branch.deletedAt) throw AppError.notFound("Branch");
  await requireRole(userId, branch.projectId, EDITORS);

  const data: Prisma.BranchUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.status !== undefined) data.status = input.status;

  if (input.slug !== undefined) {
    const taken = await repo.branchSlugExists(
      branch.projectId,
      input.slug,
      prisma,
      branch.id,
    );
    if (taken) {
      throw AppError.conflict("BRANCH_SLUG_TAKEN", "A branch with this slug already exists");
    }
    data.slug = input.slug;
  } else if (input.name !== undefined) {
    data.slug = await uniqueBranchSlug(branch.projectId, input.name, prisma, branch.id);
  }

  await repo.updateBranch(branch.id, data);

  await emit({
    projectId: branch.projectId,
    actorId: userId,
    type: "branch.updated",
    entityType: "Branch",
    entityId: branch.id,
    meta: input as unknown as Prisma.InputJsonValue,
  });

  return getBranchDetail(branch.id);
}

export async function switchBranch(userId: string, branchId: string) {
  const branch = await repo.findBranch(branchId);
  if (!branch || branch.deletedAt) throw AppError.notFound("Branch");
  await requireRole(userId, branch.projectId, EDITORS);

  await repo.setProjectDefaultBranch(branch.projectId, branch.id);

  let manifest: { path: string; sha256: string }[];
  if (branch.headVersionId) {
    const rows = await versionRepo.findVersionFilesWithFile(branch.headVersionId);
    manifest = rows.map((versionFile) => ({
      path: versionFile.path,
      sha256: versionFile.file.sha256,
    }));
  } else {
    const files = await repo.findLiveBranchFiles(branch.id, undefined);
    manifest = files.map((file) => ({ path: file.path, sha256: file.sha256 }));
  }

  await emit({
    projectId: branch.projectId,
    actorId: userId,
    type: "branch.switched",
    entityType: "Branch",
    entityId: branch.id,
    meta: { name: branch.name, fileCount: manifest.length },
  });

  return { branch: await getBranchDetail(branch.id), manifest };
}

export async function mergeBranch(
  userId: string,
  sourceBranchId: string,
  input: MergeBranchInput,
) {
  const source = await repo.findBranch(sourceBranchId);
  if (!source || source.deletedAt) throw AppError.notFound("Branch");
  await requireRole(userId, source.projectId, EDITORS);

  const target = input.targetBranchId
    ? await repo.findBranchInProject(input.targetBranchId, source.projectId)
    : await repo.findMainBranch(source.projectId);
  if (!target) throw AppError.notFound("Branch");
  if (target.id === source.id) {
    throw AppError.badRequest("SAME_BRANCH", "Cannot merge a branch into itself");
  }

  const versionId = await prisma.$transaction(async (tx) => {
    const freshTarget = await repo.findBranchInProject(target.id, source.projectId, tx);
    if (!freshTarget) throw AppError.notFound("Branch");

    const sourceFiles = await repo.findLiveBranchFiles(source.id, input.fileIds, tx);

    for (const file of sourceFiles) {
      const existing = await repo.findLiveFileByPath(freshTarget.id, file.path, tx);
      if (existing) {
        if (existing.sha256 === file.sha256) continue;
        await repo.softDeleteFile(existing.id, tx);
      }

      const createData: Prisma.FileUncheckedCreateInput = {
        projectId: source.projectId,
        branchId: freshTarget.id,
        path: file.path,
        fileName: file.fileName,
        extension: file.extension,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
        storageKey: file.storageKey,
        kind: file.kind,
      };
      if (file.imageMeta !== null) {
        createData.imageMeta = file.imageMeta as Prisma.InputJsonValue;
      }
      await repo.createFile(createData, tx);
    }

    const targetFiles = await repo.findLiveBranchFiles(freshTarget.id, undefined, tx);
    const checksum = computeChecksum(
      targetFiles.map((file) => ({ path: file.path, sha256: file.sha256 })),
    );

    const version = await versionRepo.createVersion(
      {
        branchId: freshTarget.id,
        number: (freshTarget.headVersion?.number ?? 0) + 1,
        label: `Adopt from ${source.name}`,
        createdById: userId,
        checksum,
        parentVersionId: freshTarget.headVersionId,
        sourceBranchId: source.id,
        sourceVersionId: source.headVersionId,
        files: targetFiles.map((file) => ({
          fileId: file.id,
          path: file.path,
          role: versionRepo.fileRoleForKind(file.kind),
        })),
      },
      tx,
    );

    await versionRepo.setBranchHead(freshTarget.id, version.id, tx);
    await tx.branch.update({ where: { id: source.id }, data: { status: "MERGED" } });

    await emit(
      {
        projectId: source.projectId,
        actorId: userId,
        type: "branch.merged",
        entityType: "Branch",
        entityId: source.id,
        meta: {
          targetBranchId: freshTarget.id,
          versionId: version.id,
          fileCount: targetFiles.length,
        },
      },
      tx,
    );

    return version.id;
  });

  return versionRepo.findVersionDetail(versionId);
}
