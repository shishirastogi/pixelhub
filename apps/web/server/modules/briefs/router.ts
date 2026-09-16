import { updateBriefSchema } from "@pixelhub/types/contracts/briefs";
import { parseBody, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function get(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getBrief(user.id, ctx.params.id);
}

export async function update(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, updateBriefSchema);
  return service.upsertBrief(user.id, ctx.params.id, input);
}

export async function extract(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.extractBrief(user.id, ctx.params.id);
}
