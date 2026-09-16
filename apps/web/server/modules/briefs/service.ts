import type { UpdateBriefInput } from "@pixelhub/types/contracts/briefs";
import { emit } from "../../activity";
import { AppError } from "../../errors";
import { ALL_ROLES, EDITORS, authorizeProject } from "../../auth/permissions";
import { enqueueAiJob } from "../ai/queue";
import * as repo from "./repo";

export async function getBrief(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return repo.findBriefWithRelations(project.id);
}

export async function upsertBrief(
  userId: string,
  idOrSlug: string,
  input: UpdateBriefInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);
  const existing = await repo.findActiveBrief(project.id);

  if (existing) {
    const updated = await repo.updateBrief(existing.id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      rawText: input.rawText,
      ...(input.sourceFileId !== undefined ? { sourceFileId: input.sourceFileId } : {}),
    });
    await emit({
      projectId: project.id,
      actorId: userId,
      type: "brief.updated",
      entityType: "Brief",
      entityId: updated.id,
    });
    return updated;
  }

  const created = await repo.createBrief({
    projectId: project.id,
    title: input.title ?? "Brief",
    rawText: input.rawText,
    sourceFileId: input.sourceFileId ?? null,
  });
  await emit({
    projectId: project.id,
    actorId: userId,
    type: "brief.created",
    entityType: "Brief",
    entityId: created.id,
  });
  return created;
}

export async function extractBrief(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);
  const brief = await repo.findActiveBrief(project.id);
  if (!brief) throw AppError.notFound("Brief");

  const job = await enqueueAiJob({
    projectId: project.id,
    type: "EXTRACT_REQUIREMENTS",
    input: { briefId: brief.id },
    requestedById: userId,
  });

  await repo.updateBrief(brief.id, { extractionJobId: job.id });
  await emit({
    projectId: project.id,
    actorId: userId,
    type: "brief.extraction_requested",
    entityType: "Brief",
    entityId: brief.id,
    meta: { jobId: job.id },
  });

  return { jobId: job.id };
}
