import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from "@pixelhub/types/contracts/tasks";
import { parseBody, parseQuery, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function list(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const query = parseQuery(ctx.req, listTasksQuerySchema);
  return service.listTasks(user.id, ctx.params.id, query);
}

export async function create(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createTaskSchema);
  return service.createTask(user.id, ctx.params.id, input);
}

export async function update(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, updateTaskSchema);
  return service.updateTask(user.id, ctx.params.id, input);
}
