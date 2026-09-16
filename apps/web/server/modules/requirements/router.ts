import {
  createDeliverableSchema,
  createRequirementSchema,
  linkRequirementFileSchema,
  listRequirementsQuerySchema,
  updateDeliverableSchema,
  updateRequirementSchema,
} from "@pixelhub/types/contracts/requirements";
import { parseBody, parseQuery, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function list(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const query = parseQuery(ctx.req, listRequirementsQuerySchema);
  return service.listRequirements(user.id, ctx.params.id, query);
}

export async function create(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createRequirementSchema);
  return service.createRequirement(user.id, ctx.params.id, input);
}

export async function update(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, updateRequirementSchema);
  return service.updateRequirement(user.id, ctx.params.id, input);
}

export async function remove(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.deleteRequirement(user.id, ctx.params.id);
}

export async function generateTasks(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.generateTasks(user.id, ctx.params.id);
}

export async function files(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.listFiles(user.id, ctx.params.id);
}

export async function linkFile(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, linkRequirementFileSchema);
  return service.linkFile(user.id, ctx.params.id, input);
}

export async function unlinkFile(ctx: RouteCtx<{ id: string; fileId: string }>) {
  const user = await requireUser(ctx.req);
  return service.unlinkFile(user.id, ctx.params.id, ctx.params.fileId);
}

export async function createDeliverable(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createDeliverableSchema);
  return service.createDeliverable(user.id, ctx.params.id, input);
}

export async function updateDeliverable(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, updateDeliverableSchema);
  return service.updateDeliverable(user.id, ctx.params.id, input);
}

export async function rematch(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.rematch(user.id, ctx.params.id);
}
