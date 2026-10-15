import type { Prisma } from "@prisma/client";
import type { DecisionStatus } from "@pixelhub/types";
import { prisma, type Db } from "../../db";

export function listDecisions(
  projectId: string,
  status?: DecisionStatus,
  db: Db = prisma,
) {
  return db.decision.findMany({
    where: { projectId, ...(status ? { status } : {}) },
    include: {
      decidedBy: { select: { id: true, name: true } },
      version: { select: { id: true, number: true, label: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findDecision(id: string, db: Db = prisma) {
  return db.decision.findUnique({ where: { id } });
}

export function createDecision(
  data: Prisma.DecisionUncheckedCreateInput,
  db: Db = prisma,
) {
  return db.decision.create({ data });
}

export function updateDecision(
  id: string,
  data: Prisma.DecisionUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.decision.update({ where: { id }, data });
}
