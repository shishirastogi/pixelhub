import {
  compareVersionsSchema,
  createVersionSchema,
} from "@pixelhub/types/contracts/versions";
import { parseBody, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function list(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.listVersions(user.id, ctx.params.id);
}

export async function create(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createVersionSchema);
  return service.createVersion(user.id, ctx.params.id, input);
}

export async function get(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getVersion(user.id, ctx.params.id);
}

export async function compare(ctx: RouteCtx) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, compareVersionsSchema);
  return service.compareVersions(user.id, input);
}

export async function comparisonJob(ctx: RouteCtx<{ jobId: string }>) {
  await requireUser(ctx.req);
  return service.getComparisonJob(ctx.params.jobId);
}
