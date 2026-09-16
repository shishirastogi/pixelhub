import {
  createBranchSchema,
  mergeBranchSchema,
  updateBranchSchema,
} from "@pixelhub/types/contracts/branches";
import { parseBody, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function list(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.listBranches(user.id, ctx.params.id);
}

export async function create(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createBranchSchema);
  return service.createBranch(user.id, ctx.params.id, input);
}

export async function update(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, updateBranchSchema);
  return service.updateBranch(user.id, ctx.params.id, input);
}

export async function switchBranch(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.switchBranch(user.id, ctx.params.id);
}

export async function merge(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, mergeBranchSchema);
  return service.mergeBranch(user.id, ctx.params.id, input);
}
