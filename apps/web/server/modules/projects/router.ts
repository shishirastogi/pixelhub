import {
  createProjectSchema,
  listActivityQuerySchema,
  updateProjectSchema,
} from "@pixelhub/types/contracts/projects";
import { parseBody, parseQuery, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function list(ctx: RouteCtx) {
  const user = await requireUser(ctx.req);
  return service.listProjects(user.id);
}

export async function create(ctx: RouteCtx) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createProjectSchema);
  return service.createProject(user.id, input);
}

export async function get(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getProject(user.id, ctx.params.id);
}

export async function update(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, updateProjectSchema);
  return service.updateProject(user.id, ctx.params.id, input);
}

export async function remove(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.deleteProject(user.id, ctx.params.id);
}

export async function pulse(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getPulse(user.id, ctx.params.id);
}

export async function activity(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const query = parseQuery(ctx.req, listActivityQuerySchema);
  return service.listActivity(user.id, ctx.params.id, query);
}
