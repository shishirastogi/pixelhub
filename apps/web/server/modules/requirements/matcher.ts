import picomatch from "picomatch";
import { emit } from "../../activity";
import { prisma } from "../../db";
import * as repo from "./repo";

export interface MatchableFile {
  id: string;
  projectId: string;
  path: string;
  fileName: string;
  branchId: string | null;
}

export interface MatchFileResult {
  matched: number;
  requirementIds: string[];
}

/** Glob match supporting brace expansion (e.g. "instagram_post_*.{png,jpg}"). */
export function matchesPattern(fileName: string, pattern: string): boolean {
  if (!pattern) return false;
  return picomatch(pattern, { dot: true })(fileName);
}

/**
 * Derived requirement coverage: FULFILLED once every deliverable is SATISFIED,
 * demoted back to ACCEPTED when coverage drops. Emits only on promotion.
 */
export async function recomputeRequirementStatus(
  requirementId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const requirement = await tx.requirement.findUnique({
      where: { id: requirementId },
      include: { deliverables: true },
    });
    if (!requirement || requirement.deletedAt) return;

    const total = requirement.deliverables.length;
    const satisfied = requirement.deliverables.filter(
      (deliverable) => deliverable.status === "SATISFIED",
    ).length;

    if (requirement.status === "ACCEPTED" && total > 0 && satisfied === total) {
      await tx.requirement.update({
        where: { id: requirementId },
        data: { status: "FULFILLED" },
      });
      await emit(
        {
          projectId: requirement.projectId,
          actorId: null,
          type: "requirement.fulfilled",
          entityType: "Requirement",
          entityId: requirementId,
          meta: { satisfied, total },
        },
        tx,
      );
    } else if (
      requirement.status === "FULFILLED" &&
      (total === 0 || satisfied < total)
    ) {
      await tx.requirement.update({
        where: { id: requirementId },
        data: { status: "ACCEPTED" },
      });
    }
  });
}

/**
 * Stage A deterministic matching: glob a file against ACCEPTED/FULFILLED
 * requirements' open (or stale — satisfied by a superseded revision)
 * deliverable patterns, link + satisfy, then recompute coverage.
 */
export async function matchFile(file: MatchableFile): Promise<MatchFileResult> {
  const pathBoosted = /exports|deliverables/i.test(file.path);
  const requirements = await repo.findMatchableRequirementGroups(file.projectId);

  const requirementIds = new Set<string>();
  let matched = 0;

  await prisma.$transaction(async (tx) => {
    for (const requirement of requirements) {
      for (const deliverable of requirement.deliverables) {
        const hit = deliverable.filePatterns.some((pattern) =>
          matchesPattern(file.fileName, pattern),
        );
        if (!hit) continue;

        const current = await tx.deliverable.findUnique({
          where: { id: deliverable.id },
          select: { satisfiedByFileId: true },
        });
        if (!current) continue;

        if (current.satisfiedByFileId && current.satisfiedByFileId !== file.id) {
          await repo.markLinkSuperseded(
            requirement.id,
            current.satisfiedByFileId,
            tx,
          );
        }

        await repo.upsertFileLink(
          {
            requirementId: requirement.id,
            fileId: file.id,
            linkType: "SATISFIES",
            matchedBy: "WATCHER_RULE",
            confidence: 1,
          },
          tx,
        );
        await repo.satisfyDeliverable(deliverable.id, file.id, tx);

        matched += 1;
        requirementIds.add(requirement.id);
      }
    }
  });

  if (requirementIds.size > 0) {
    for (const requirementId of requirementIds) {
      await recomputeRequirementStatus(requirementId);
    }

    await emit({
      projectId: file.projectId,
      actorId: null,
      type: "file.matched",
      entityType: "File",
      entityId: file.id,
      meta: {
        requirementIds: [...requirementIds],
        matched,
        pathBoosted,
      },
    });
  }

  return { matched, requirementIds: [...requirementIds] };
}

/** Re-run Stage A across a project's existing export/deliverable files. */
export async function rematchDeliverables(
  projectId: string,
): Promise<{ matched: number }> {
  const files = await repo.findExportFiles(projectId);
  let matched = 0;

  for (const file of files) {
    const result = await matchFile(file);
    matched += result.matched;
  }

  return { matched };
}
