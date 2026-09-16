import { ALL_ROLES, authorizeProject, requireRole } from "../../auth/permissions";
import { requireUser } from "../../auth/session";
import { AppError } from "../../errors";
import type { RouteCtx } from "../../http";
import { enqueueAiJob } from "./queue";
import * as repo from "./repo";

export async function statusNarrative(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const { project } = await authorizeProject(user.id, ctx.params.id, ALL_ROLES);

  const job = await enqueueAiJob({
    projectId: project.id,
    type: "PROJECT_STATUS_NARRATIVE",
    input: {},
    requestedById: user.id,
  });

  return { jobId: job.id };
}

export async function getJob(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const job = await repo.findJob(ctx.params.id);
  if (!job) throw AppError.notFound("AiJob");

  await requireRole(user.id, job.projectId, ALL_ROLES);

  return {
    id: job.id,
    type: job.type,
    status: job.status,
    resultJson: job.resultJson,
    error: job.error,
    tokensIn: job.tokensIn,
    tokensOut: job.tokensOut,
    model: job.model,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  };
}

export async function listJobs(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const { project } = await authorizeProject(user.id, ctx.params.id, ALL_ROLES);

  const items = await repo.listJobsForProject(project.id);

  const totals = items.reduce(
    (acc, job) => {
      acc.tokensIn += job.tokensIn ?? 0;
      acc.tokensOut += job.tokensOut ?? 0;
      acc.jobs += 1;
      return acc;
    },
    { tokensIn: 0, tokensOut: 0, jobs: 0 },
  );

  return { items, totals };
}
