import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../../db";

export function findBranches(projectId: string) {
  return prisma.branch.findMany({
    where: { projectId, deletedAt: null },
    include: {
      headVersion: {
        select: { id: true, number: true, label: true, checksum: true, createdAt: true },
      },
      _count: { select: { files: { where: { deletedAt: null } } } },
    },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
}

export function findBranch(id: string, db: Db = prisma) {
  return db.branch.findUnique({
    where: { id },
    include: { headVersion: true },
  });
}

export function findBranchInProject(
  id: string,
  projectId: string,
  db: Db = prisma,
) {
  return db.branch.findFirst({
    where: { id, projectId, deletedAt: null },
    include: { headVersion: true },
  });
}

export function findMainBranch(projectId: string, db: Db = prisma) {
  return db.branch.findFirst({
    where: { projectId, kind: "MAIN", deletedAt: null },
    include: { headVersion: true },
  });
}

export async function branchSlugExists(
  projectId: string,
  slug: string,
  db: Db = prisma,
  excludeId?: string,
): Promise<boolean> {
  const found = await db.branch.findFirst({
    where: {
      projectId,
      slug,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}

export function createBranch(data: Prisma.BranchUncheckedCreateInput, db: Db) {
  return db.branch.create({
    data,
    include: { headVersion: true },
  });
}

export function updateBranch(
  id: string,
  data: Prisma.BranchUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.branch.update({
    where: { id },
    data,
    include: { headVersion: true },
  });
}

export function setProjectDefaultBranch(
  projectId: string,
  branchId: string,
  db: Db = prisma,
) {
  return db.project.update({
    where: { id: projectId },
    data: { defaultBranchId: branchId },
  });
}

export function findLiveBranchFiles(
  branchId: string,
  fileIds: string[] | undefined,
  db: Db = prisma,
) {
  return db.file.findMany({
    where: {
      branchId,
      deletedAt: null,
      ...(fileIds ? { id: { in: fileIds } } : {}),
    },
    orderBy: { path: "asc" },
  });
}

export function findLiveFileByPath(branchId: string, path: string, db: Db = prisma) {
  return db.file.findFirst({
    where: { branchId, path, deletedAt: null },
  });
}

export function softDeleteFile(id: string, db: Db) {
  return db.file.update({ where: { id }, data: { deletedAt: new Date() } });
}

export function createFile(data: Prisma.FileUncheckedCreateInput, db: Db) {
  return db.file.create({ data });
}

export function findBranchDetail(id: string) {
  return prisma.branch.findUnique({
    where: { id },
    include: {
      headVersion: {
        select: { id: true, number: true, label: true, checksum: true, createdAt: true },
      },
      _count: { select: { files: { where: { deletedAt: null } } } },
    },
  });
}
