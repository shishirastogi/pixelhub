import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../../db";

export function findActiveBrief(projectId: string) {
  return prisma.brief.findFirst({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export function findBriefWithRelations(projectId: string) {
  return prisma.brief.findFirst({
    where: { projectId, deletedAt: null },
    include: {
      sourceFile: { select: { id: true, fileName: true, path: true, kind: true } },
      requirements: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function createBrief(data: Prisma.BriefUncheckedCreateInput, db: Db = prisma) {
  return db.brief.create({ data });
}

export function updateBrief(
  id: string,
  data: Prisma.BriefUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.brief.update({ where: { id }, data });
}
