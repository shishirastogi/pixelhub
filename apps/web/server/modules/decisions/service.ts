import type { Prisma } from "@prisma/client";
import type {
  CreateDecisionInput,
  ListDecisionsQuery,
  UpdateDecisionInput,
} from "@pixelhub/types/contracts/decisions";
import { emit } from "../../activity";
import { AppError } from "../../errors";
import {
  ALL_ROLES,
  EDITORS,
  authorizeProject,
  requireRole,
  resolveProject,
} from "../../auth/permissions";
import * as repo from "./repo";

export async function listDecisions(
  userId: string,
  idOrSlug: string,
  query: ListDecisionsQuery,
) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return repo.listDecisions(project.id, query.status);
}

export async function createDecision(
  userId: string,
  idOrSlug: string,
  input: CreateDecisionInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);

  const status = input.status ?? "PROPOSED";
  const decided = status === "DECIDED";

  const decision = await repo.createDecision({
    projectId: project.id,
    title: input.title,
    decision: input.decision,
    reason: input.reason,
    status,
    versionId: input.versionId ?? null,
    designSheetItemId: input.designSheetItemId ?? null,
    decidedById: decided ? userId : null,
    decidedAt: decided ? new Date() : null,
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "decision.created",
    entityType: "Decision",
    entityId: decision.id,
    meta: { status },
  });

  return decision;
}

export async function updateDecision(
  userId: string,
  id: string,
  input: UpdateDecisionInput,
) {
  const existing = await repo.findDecision(id);
  if (!existing) throw AppError.notFound("Decision");

  const project = await resolveProject(existing.projectId);
  await requireRole(userId, project.id, EDITORS);

  const becomingDecided =
    input.status === "DECIDED" && existing.status !== "DECIDED";

  const decision = await repo.updateDecision(id, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.decision !== undefined ? { decision: input.decision } : {}),
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.versionId !== undefined ? { versionId: input.versionId } : {}),
    ...(input.designSheetItemId !== undefined
      ? { designSheetItemId: input.designSheetItemId }
      : {}),
    ...(input.supersedesId !== undefined
      ? { supersedesId: input.supersedesId }
      : {}),
    ...(becomingDecided ? { decidedById: userId, decidedAt: new Date() } : {}),
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "decision.updated",
    entityType: "Decision",
    entityId: decision.id,
    meta: input as Prisma.InputJsonValue,
  });

  return decision;
}
