import { createCommentSchema } from "@pixelhub/types/contracts/comments";
import { parseBody, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function list(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.listVersionComments(user.id, ctx.params.id);
}

export async function create(ctx: RouteCtx) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createCommentSchema);
  return service.createComment(user.id, input);
}

export async function resolve(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.resolveComment(user.id, ctx.params.id);
}

export async function convertToTask(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.convertCommentToTask(user.id, ctx.params.id);
}
