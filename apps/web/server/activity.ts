import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface EmitActivityInput {
  projectId: string;
  actorId?: string | null;
  /** e.g. "file.created", "version.created", "requirement.fulfilled", "branch.merged" */
  type: string;
  entityType: string;
  entityId: string;
  meta?: Prisma.InputJsonValue;
}

/**
 * Single funnel for every mutation. Feeds the activity feed AND the analytics
 * engine (docs/08-analytics.md §1). Call inside the same transaction where possible.
 */
export async function emit(
  input: EmitActivityInput,
  tx: Pick<Prisma.TransactionClient, "activityEvent"> = prisma,
): Promise<void> {
  await tx.activityEvent.create({
    data: {
      projectId: input.projectId,
      actorId: input.actorId ?? null,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      meta: input.meta,
    },
  });
}
