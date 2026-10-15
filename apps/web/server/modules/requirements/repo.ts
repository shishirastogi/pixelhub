import type { Prisma } from "@prisma/client";
import type { LinkType, MatchedBy, RequirementStatus } from "@pixelhub/types";
import { prisma, type Db } from "../../db";

export function findRequirements(projectId: string, status?: RequirementStatus) {
  return prisma.requirement.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    include: { deliverables: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export function findRequirementById(id: string) {
  return prisma.requirement.findFirst({
    where: { id, deletedAt: null },
    include: { deliverables: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * Requirements that can still be matched: ACCEPTED/FULFILLED with deliverables
 * that are either open or satisfied by a stale (soft-deleted) file revision.
 */
export function findMatchableRequirementGroups(
  projectId: string,
  db: Db = prisma,
) {
  return db.requirement.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: { in: ["ACCEPTED", "FULFILLED"] },
    },
    include: {
      deliverables: {
        where: {
          OR: [
            { status: "OPEN" },
            {
              status: "SATISFIED",
              satisfiedByFile: { deletedAt: { not: null } },
            },
          ],
        },
      },
    },
  });
}

export function createRequirement(
  data: Prisma.RequirementUncheckedCreateInput,
  db: Db = prisma,
) {
  return db.requirement.create({ data, include: { deliverables: true } });
}

export function updateRequirement(
  id: string,
  data: Prisma.RequirementUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.requirement.update({
    where: { id },
    data,
    include: { deliverables: true },
  });
}

export function softDeleteRequirement(id: string, db: Db = prisma) {
  return db.requirement.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export function findFileInProject(fileId: string, projectId: string) {
  return prisma.file.findFirst({
    where: { id: fileId, projectId, deletedAt: null },
    select: { id: true, fileName: true, path: true },
  });
}

export function findRequirementLinks(requirementId: string) {
  return prisma.requirementFileLink.findMany({
    where: { requirementId },
    include: {
      file: {
        include: { previews: { where: { kind: "THUMB" }, take: 1 } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export interface UpsertFileLinkInput {
  requirementId: string;
  fileId: string;
  linkType: LinkType;
  matchedBy: MatchedBy;
  confidence?: number | null;
}

export function upsertFileLink(data: UpsertFileLinkInput, db: Db = prisma) {
  return db.requirementFileLink.upsert({
    where: {
      requirementId_fileId: {
        requirementId: data.requirementId,
        fileId: data.fileId,
      },
    },
    create: {
      requirementId: data.requirementId,
      fileId: data.fileId,
      linkType: data.linkType,
      matchedBy: data.matchedBy,
      confidence: data.confidence ?? null,
    },
    update: {
      linkType: data.linkType,
      matchedBy: data.matchedBy,
      confidence: data.confidence ?? null,
    },
  });
}

export function deleteFileLink(
  requirementId: string,
  fileId: string,
  db: Db = prisma,
) {
  return db.requirementFileLink.deleteMany({ where: { requirementId, fileId } });
}

export function findDeliverableById(id: string) {
  return prisma.deliverable.findUnique({
    where: { id },
    include: {
      requirement: {
        select: { id: true, projectId: true, deletedAt: true },
      },
    },
  });
}

export function createDeliverable(
  data: Prisma.DeliverableUncheckedCreateInput,
  db: Db = prisma,
) {
  return db.deliverable.create({ data });
}

export function updateDeliverable(
  id: string,
  data: Prisma.DeliverableUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.deliverable.update({ where: { id }, data });
}

export function markLinkSuperseded(
  requirementId: string,
  fileId: string,
  db: Db = prisma,
) {
  return db.requirementFileLink.updateMany({
    where: { requirementId, fileId },
    data: { linkType: "SUPERSEDED" },
  });
}

export function satisfyDeliverable(id: string, fileId: string, db: Db = prisma) {
  return db.deliverable.update({
    where: { id },
    data: {
      status: "SATISFIED",
      satisfiedByFileId: fileId,
      satisfiedAt: new Date(),
    },
  });
}

export function unsatisfyDeliverablesByFile(
  requirementId: string,
  fileId: string,
  db: Db = prisma,
) {
  return db.deliverable.updateMany({
    where: { requirementId, satisfiedByFileId: fileId },
    data: {
      status: "OPEN",
      satisfiedByFileId: null,
      satisfiedAt: null,
    },
  });
}

export function findExportFiles(projectId: string) {
  return prisma.file.findMany({
    where: {
      projectId,
      deletedAt: null,
      kind: { in: ["EXPORT", "DELIVERABLE"] },
    },
    select: {
      id: true,
      projectId: true,
      path: true,
      fileName: true,
      branchId: true,
    },
  });
}
