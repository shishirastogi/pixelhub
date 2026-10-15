import type { Prisma } from "@prisma/client";
import { prisma } from "../../db";

export function findLiveFileByPath(
  projectId: string,
  branchId: string | null,
  path: string,
) {
  return prisma.file.findFirst({
    where: { projectId, branchId, path, deletedAt: null },
  });
}

export function findFileBySha256(projectId: string, sha256: string) {
  return prisma.file.findFirst({
    where: { projectId, sha256 },
    orderBy: { createdAt: "desc" },
  });
}

export function countFilesBySha256(projectId: string, sha256: string) {
  return prisma.file.count({ where: { projectId, sha256 } });
}

export function softDeleteFile(id: string) {
  return prisma.file.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function detachFileFromDeliverables(fileId: string): Promise<string[]> {
  const deliverables = await prisma.deliverable.findMany({
    where: { satisfiedByFileId: fileId },
    select: { id: true, requirementId: true },
  });
  const links = await prisma.requirementFileLink.findMany({
    where: { fileId },
    select: { requirementId: true },
  });
  const requirementIds = new Set<string>([
    ...deliverables.map((d) => d.requirementId),
    ...links.map((l) => l.requirementId),
  ]);

  if (deliverables.length > 0) {
    await prisma.deliverable.updateMany({
      where: { satisfiedByFileId: fileId },
      data: { status: "OPEN", satisfiedByFileId: null, satisfiedAt: null },
    });
  }
  await prisma.requirementFileLink.deleteMany({ where: { fileId } });

  return [...requirementIds];
}

export function updateFileImageMeta(
  id: string,
  imageMeta: Prisma.InputJsonValue,
) {
  return prisma.file.update({
    where: { id },
    data: { imageMeta, analyzedAt: new Date() },
  });
}

export function createFile(data: Prisma.FileUncheckedCreateInput) {
  return prisma.file.create({ data });
}

export function updateFileLocation(
  id: string,
  data: { path: string; fileName: string; extension: string },
) {
  return prisma.file.update({ where: { id }, data });
}

export function findFileById(id: string) {
  return prisma.file.findUnique({ where: { id } });
}

export function findFileDetailById(id: string) {
  return prisma.file.findUnique({
    where: { id },
    include: {
      previews: { orderBy: { createdAt: "asc" } },
      requirementLinks: {
        include: {
          requirement: {
            select: {
              id: true,
              projectId: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              quantity: true,
              dueDate: true,
            },
          },
        },
      },
      brandCheckResults: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export function findBrandKit(projectId: string) {
  return prisma.brandKit.findUnique({
    where: { projectId },
    select: { id: true },
  });
}

export async function listFiles(
  projectId: string,
  options: {
    kind?: Prisma.FileWhereInput["kind"];
    branchId?: string;
    q?: string;
    cursor?: string;
    limit: number;
  },
) {
  const where: Prisma.FileWhereInput = {
    projectId,
    deletedAt: null,
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.branchId ? { branchId: options.branchId } : {}),
    ...(options.q
      ? {
          OR: [
            { fileName: { contains: options.q, mode: "insensitive" } },
            { path: { contains: options.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.file.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: {
      previews: { where: { kind: "THUMB" }, take: 1 },
      _count: { select: { requirementLinks: true } },
    },
  });

  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}
