import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../../db";

const DAY_MS = 24 * 60 * 60 * 1000;

export function findBranchVersions(projectId: string) {
  return prisma.branch.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      versions: {
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function countMergesSince(projectId: string, since: Date) {
  return prisma.activityEvent.count({
    where: { projectId, type: "branch.merged", createdAt: { gte: since } },
  });
}

export function findRequirements(projectId: string) {
  return prisma.requirement.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      status: true,
      dueDate: true,
      _count: { select: { fileLinks: true } },
    },
  });
}

export function findFiles(projectId: string) {
  return prisma.file.findMany({
    where: { projectId, deletedAt: null },
    select: { extension: true, sha256: true, kind: true, sizeBytes: true },
  });
}

export function groupDeliverablesByStatus(projectId: string) {
  return prisma.deliverable.groupBy({
    by: ["status"],
    where: { requirement: { projectId, deletedAt: null } },
    _count: { _all: true },
  });
}

export function countOutdatedAssets(projectId: string) {
  return prisma.deliverable.count({
    where: {
      status: "SATISFIED",
      requirement: { projectId, deletedAt: null },
      satisfiedByFile: {
        is: { requirementLinks: { some: { linkType: "SUPERSEDED" } } },
      },
    },
  });
}

export function listActiveActors(projectId: string, since: Date) {
  return prisma.activityEvent.findMany({
    where: { projectId, createdAt: { gte: since }, actorId: { not: null } },
    distinct: ["actorId"],
    select: { actorId: true },
  });
}

export function countComments(projectId: string) {
  return prisma.comment.count({ where: { projectId } });
}

export function findConvertedComments(projectId: string) {
  return prisma.comment.findMany({
    where: { projectId, convertedTaskId: { not: null } },
    select: {
      createdAt: true,
      convertedTask: { select: { status: true, updatedAt: true } },
    },
  });
}

export function findApprovedBranches(projectId: string) {
  return prisma.branch.findMany({
    where: { projectId, deletedAt: null, status: "APPROVED" },
    select: { id: true, _count: { select: { versions: true } } },
  });
}

export function findVersionComparisons(projectId: string) {
  return prisma.versionComparison.findMany({
    where: { projectId },
    select: { diffJson: true },
  });
}

export function aggregateAiJobs(projectId: string) {
  return prisma.aiJob.aggregate({
    where: { projectId },
    _count: { _all: true },
    _sum: { tokensIn: true, tokensOut: true },
  });
}

export function findRecentSnapshots(projectId: string, take: number) {
  return prisma.analyticsSnapshot.findMany({
    where: { projectId },
    orderBy: { date: "desc" },
    take,
    select: { date: true, metrics: true },
  });
}

export function upsertSnapshot(
  projectId: string,
  date: Date,
  metrics: Prisma.InputJsonValue,
  db: Db = prisma,
) {
  return db.analyticsSnapshot.upsert({
    where: { projectId_date: { projectId, date } },
    create: { projectId, date, metrics },
    update: { metrics, computedAt: new Date() },
  });
}

export { DAY_MS };
