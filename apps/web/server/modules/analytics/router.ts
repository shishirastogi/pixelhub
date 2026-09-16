import { requireUser } from "../../auth/session";
import type { RouteCtx } from "../../http";
import * as service from "./service";

export async function versions(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getVersionAnalytics(user.id, ctx.params.id);
}

export async function requirements(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getRequirementAnalytics(user.id, ctx.params.id);
}

export async function files(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getFileAnalytics(user.id, ctx.params.id);
}

export async function collaboration(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getCollaborationAnalytics(user.id, ctx.params.id);
}

export async function recompute(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.recompute(user.id, ctx.params.id);
}
