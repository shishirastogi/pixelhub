import type { Prisma } from "@prisma/client";
import type {
  CreateDeliverableInput,
  CreateRequirementInput,
  LinkRequirementFileInput,
  ListRequirementsQuery,
  UpdateDeliverableInput,
  UpdateRequirementInput,
} from "@pixelhub/types/contracts/requirements";
import { emit } from "../../activity";
import { prisma } from "../../db";
import { AppError } from "../../errors";
import {
  ALL_ROLES,
  EDITORS,
  authorizeProject,
  requireRole,
} from "../../auth/permissions";
import { enqueueAiJob } from "../ai/queue";
import { recomputeRequirementStatus, rematchDeliverables } from "./matcher";
import * as repo from "./repo";

export interface Coverage {
  satisfied: number;
  total: number;
}

function coverageOf(deliverables: { status: string }[]): Coverage {
  const total = deliverables.length;
  const satisfied = deliverables.filter(
    (deliverable) => deliverable.status === "SATISFIED",
  ).length;
  return { satisfied, total };
}

function isStatusEvent(
  status: string,
): status is "ACCEPTED" | "REJECTED" | "FULFILLED" {
  return status === "ACCEPTED" || status === "REJECTED" || status === "FULFILLED";
}

async function loadRequirementOrThrow(requirementId: string) {
  const requirement = await repo.findRequirementById(requirementId);
  if (!requirement) throw AppError.notFound("Requirement");
  return requirement;
}

export async function listRequirements(
  userId: string,
  idOrSlug: string,
  query: ListRequirementsQuery,
) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  const status =
    query.status && query.status !== "ALL" ? query.status : undefined;
  const requirements = await repo.findRequirements(project.id, status);

  return requirements.map((requirement) => ({
    ...requirement,
    coverage: coverageOf(requirement.deliverables),
  }));
}

export async function createRequirement(
  userId: string,
  idOrSlug: string,
  input: CreateRequirementInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);

  const requirement = await prisma.$transaction(async (tx) => {
    const created = await repo.createRequirement(
      {
        projectId: project.id,
        title: input.title,
        description: input.description ?? null,
        source: "MANUAL",
        status: "ACCEPTED",
        quantity: input.quantity ?? 1,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority ?? "MEDIUM",
        sortOrder: input.sortOrder ?? 0,
        deliverables: input.deliverables
          ? {
              create: input.deliverables.map((deliverable) => ({
                name: deliverable.name,
                filePatterns: [deliverable.filePattern],
              })),
            }
          : undefined,
      },
      tx,
    );

    await emit(
      {
        projectId: project.id,
        actorId: userId,
        type: "requirement.created",
        entityType: "Requirement",
        entityId: created.id,
        meta: { title: created.title, source: created.source },
      },
      tx,
    );

    return created;
  });

  return { ...requirement, coverage: coverageOf(requirement.deliverables) };
}

export async function updateRequirement(
  userId: string,
  requirementId: string,
  input: UpdateRequirementInput,
) {
  const requirement = await loadRequirementOrThrow(requirementId);
  await requireRole(userId, requirement.projectId, EDITORS);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await repo.updateRequirement(
      requirementId,
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      tx,
    );

    await emit(
      {
        projectId: requirement.projectId,
        actorId: userId,
        type: input.status && isStatusEvent(input.status)
          ? `requirement.${input.status.toLowerCase()}`
          : "requirement.updated",
        entityType: "Requirement",
        entityId: requirementId,
        meta: input as unknown as Prisma.InputJsonValue,
      },
      tx,
    );

    return row;
  });

  return { ...updated, coverage: coverageOf(updated.deliverables) };
}

export async function deleteRequirement(
  userId: string,
  requirementId: string,
) {
  const requirement = await loadRequirementOrThrow(requirementId);
  await requireRole(userId, requirement.projectId, EDITORS);

  await prisma.$transaction(async (tx) => {
    await repo.softDeleteRequirement(requirementId, tx);
    await emit(
      {
        projectId: requirement.projectId,
        actorId: userId,
        type: "requirement.deleted",
        entityType: "Requirement",
        entityId: requirementId,
      },
      tx,
    );
  });

  return { ok: true };
}

export async function generateTasks(userId: string, requirementId: string) {
  const requirement = await loadRequirementOrThrow(requirementId);
  await requireRole(userId, requirement.projectId, EDITORS);

  const job = await enqueueAiJob({
    projectId: requirement.projectId,
    type: "GENERATE_TASKS",
    input: { requirementId },
    requestedById: userId,
  });

  await emit({
    projectId: requirement.projectId,
    actorId: userId,
    type: "requirement.tasks_requested",
    entityType: "Requirement",
    entityId: requirementId,
    meta: { jobId: job.id },
  });

  return { jobId: job.id };
}

export async function listFiles(userId: string, requirementId: string) {
  const requirement = await loadRequirementOrThrow(requirementId);
  await requireRole(userId, requirement.projectId, ALL_ROLES);

  const links = await repo.findRequirementLinks(requirementId);

  return {
    deliverables: requirement.deliverables.map((deliverable) => ({
      id: deliverable.id,
      name: deliverable.name,
      status: deliverable.status,
      satisfiedByFileId: deliverable.satisfiedByFileId,
    })),
    links: links.map((link) => ({
      fileId: link.fileId,
      linkType: link.linkType,
      matchedBy: link.matchedBy,
      confidence: link.confidence,
      file: {
        id: link.file.id,
        fileName: link.file.fileName,
        path: link.file.path,
        kind: link.file.kind,
        previewStorageKey: link.file.previews[0]?.storageKey ?? null,
      },
    })),
  };
}

export async function linkFile(
  userId: string,
  requirementId: string,
  input: LinkRequirementFileInput,
) {
  const requirement = await loadRequirementOrThrow(requirementId);
  await requireRole(userId, requirement.projectId, EDITORS);

  const file = await repo.findFileInProject(input.fileId, requirement.projectId);
  if (!file) throw AppError.notFound("File");

  const link = await repo.upsertFileLink({
    requirementId,
    fileId: input.fileId,
    linkType: input.linkType ?? "SATISFIES",
    matchedBy: input.matchedBy ?? "MANUAL",
    confidence: input.confidence ?? null,
  });

  await recomputeRequirementStatus(requirementId);
  await emit({
    projectId: requirement.projectId,
    actorId: userId,
    type: "requirement.file_linked",
    entityType: "Requirement",
    entityId: requirementId,
    meta: { fileId: input.fileId, linkType: link.linkType },
  });

  return link;
}

export async function unlinkFile(
  userId: string,
  requirementId: string,
  fileId: string,
) {
  const requirement = await loadRequirementOrThrow(requirementId);
  await requireRole(userId, requirement.projectId, EDITORS);

  await repo.deleteFileLink(requirementId, fileId);
  await recomputeRequirementStatus(requirementId);
  await emit({
    projectId: requirement.projectId,
    actorId: userId,
    type: "requirement.file_unlinked",
    entityType: "Requirement",
    entityId: requirementId,
    meta: { fileId },
  });

  return { ok: true };
}

export async function createDeliverable(
  userId: string,
  requirementId: string,
  input: CreateDeliverableInput,
) {
  const requirement = await loadRequirementOrThrow(requirementId);
  await requireRole(userId, requirement.projectId, EDITORS);

  const deliverable = await repo.createDeliverable({
    requirementId,
    name: input.name,
    filePatterns: input.filePatterns,
  });

  await emit({
    projectId: requirement.projectId,
    actorId: userId,
    type: "requirement.deliverable_added",
    entityType: "Requirement",
    entityId: requirementId,
    meta: { deliverableId: deliverable.id, name: deliverable.name },
  });

  return deliverable;
}

export async function updateDeliverable(
  userId: string,
  deliverableId: string,
  input: UpdateDeliverableInput,
) {
  const deliverable = await repo.findDeliverableById(deliverableId);
  if (!deliverable || deliverable.requirement.deletedAt) {
    throw AppError.notFound("Deliverable");
  }
  await requireRole(userId, deliverable.requirement.projectId, EDITORS);

  const updated = await repo.updateDeliverable(deliverableId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.filePatterns !== undefined
      ? { filePatterns: input.filePatterns }
      : {}),
    ...(input.status !== undefined
      ? {
          status: input.status,
          satisfiedAt: input.status === "SATISFIED" ? new Date() : null,
        }
      : {}),
  });

  await recomputeRequirementStatus(deliverable.requirementId);
  await emit({
    projectId: deliverable.requirement.projectId,
    actorId: userId,
    type: "requirement.deliverable_updated",
    entityType: "Requirement",
    entityId: deliverable.requirementId,
    meta: { deliverableId, status: updated.status },
  });

  return updated;
}

export async function rematch(userId: string, deliverableId: string) {
  const deliverable = await repo.findDeliverableById(deliverableId);
  if (!deliverable || deliverable.requirement.deletedAt) {
    throw AppError.notFound("Deliverable");
  }
  await requireRole(userId, deliverable.requirement.projectId, EDITORS);

  return rematchDeliverables(deliverable.requirement.projectId);
}
