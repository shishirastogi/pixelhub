import {
  listBrandChecksQuerySchema,
  resolveBrandCheckSchema,
  runBrandCheckSchema,
  saveBrandKitSchema,
} from "@pixelhub/types/contracts/brandkit";
import { parseBody, parseQuery, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function get(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getBrandKit(user.id, ctx.params.id);
}

export async function save(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, saveBrandKitSchema);
  return service.saveBrandKit(user.id, ctx.params.id, input);
}

export async function check(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, runBrandCheckSchema);
  return service.runBrandCheck(user.id, ctx.params.id, input);
}

export async function listChecks(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const query = parseQuery(ctx.req, listBrandChecksQuerySchema);
  return service.listBrandChecks(user.id, ctx.params.id, query);
}

export async function resolveCheck(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, resolveBrandCheckSchema);
  return service.resolveBrandCheck(user.id, ctx.params.id, input);
}
