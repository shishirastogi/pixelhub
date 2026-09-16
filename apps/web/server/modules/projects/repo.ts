import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../../db";

export function findProjectsForUser(userId: string) {
  return prisma.project.findMany({
    where: { deletedAt: null, members: { some: { userId } } },
    include: {
      defaultBranch: { select: { id: true, name: true, slug: true, kind: true } },
      members: { where: { userId }, select: { role: true } },
      _count: { select: { files: true, requirements: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function findProjectDetail(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      defaultBranch: { include: { headVersion: true } },
      brandKit: { select: { id: true, name: true } },
      _count: {
        select: { branches: true, files: true, requirements: true, tasks: true },
      },
    },
  });
}

export async function projectSlugExists(slug: string, db: Db = prisma): Promise<boolean> {
  const found = await db.project.findUnique({ where: { slug }, select: { id: true } });
  return Boolean(found);
}

export function createProject(data: Prisma.ProjectCreateInput, db: Db) {
  return db.project.create({
    data,
    include: { branches: true },
  });
}

export function setDefaultBranch(projectId: string, branchId: string, db: Db) {
  return db.project.update({
    where: { id: projectId },
    data: { defaultBranchId: branchId },
  });
}

export function updateProject(id: string, data: Prisma.ProjectUpdateInput) {
  return prisma.project.update({ where: { id }, data });
}

export function softDeleteProject(id: string) {
  return prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
}

export function findAcceptedRequirements(projectId: string) {
  return prisma.requirement.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: { in: ["ACCEPTED", "FULFILLED"] },
    },
    include: {
      deliverables: true,
      _count: { select: { fileLinks: true } },
    },
  });
}

export function findProjectBranchHead(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { defaultBranch: { include: { headVersion: true } } },
  });
}

export function countOpenTasks(projectId: string) {
  return prisma.task.count({
    where: { projectId, status: { in: ["TODO", "IN_PROGRESS"] } },
  });
}

export function findFailingBrandChecks(projectId: string) {
  return prisma.brandCheckResult.findMany({
    where: { projectId, status: "FAIL", resolvedAt: null },
    include: { file: { select: { id: true, fileName: true, path: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

export async function listActivity(
  projectId: string,
  options: { cursor?: string; limit: number },
) {
  const rows = await prisma.activityEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: options.limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
  return { items, nextCursor };
}
