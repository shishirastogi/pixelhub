import {
  createDecisionSchema,
  listDecisionsQuerySchema,
  updateDecisionSchema,
} from "@pixelhub/types/contracts/decisions";
import { parseBody, parseQuery, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function list(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const query = parseQuery(ctx.req, listDecisionsQuerySchema);
  return service.listDecisions(user.id, ctx.params.id, query);
}

export async function create(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createDecisionSchema);
  return service.createDecision(user.id, ctx.params.id, input);
}

export async function update(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, updateDecisionSchema);
  return service.updateDecision(user.id, ctx.params.id, input);
}
