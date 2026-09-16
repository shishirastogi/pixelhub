import type { Prisma } from "@prisma/client";
import type { AiJobType } from "@pixelhub/types";
import { prisma } from "../../db";
import { runAiJob } from "./service";

export interface EnqueueAiJobInput {
  projectId: string;
  type: AiJobType;
  input?: Record<string, unknown>;
  requestedById?: string | null;
}

/**
 * Creates an AiJob row and dispatches it. MVP runs the job in-process
 * (fire-and-forget) so the API works without Redis; the BullMQ `ai` queue
 * (docs/03 §3) replaces the dispatch line in production.
 */
export async function enqueueAiJob(
  input: EnqueueAiJobInput,
): Promise<{ id: string }> {
  const job = await prisma.aiJob.create({
    data: {
      projectId: input.projectId,
      type: input.type,
      inputJson: (input.input ?? {}) as Prisma.InputJsonValue,
      requestedById: input.requestedById ?? null,
      status: "QUEUED",
    },
    select: { id: true },
  });

  void runAiJob(job.id).catch(async (error: unknown) => {
    await prisma.aiJob
      .update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        },
      })
      .catch(() => undefined);
  });

  return { id: job.id };
}
