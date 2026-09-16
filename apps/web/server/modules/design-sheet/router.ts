import {
  createDesignSheetItemSchema,
  saveDesignSheetPositionsSchema,
  updateDesignSheetItemSchema,
} from "@pixelhub/types/contracts/design-sheet";
import { parseBody, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import * as service from "./service";

export async function list(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.listDesignSheetItems(user.id, ctx.params.id);
}

export async function create(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, createDesignSheetItemSchema);
  return service.createDesignSheetItem(user.id, ctx.params.id, input);
}

export async function update(ctx: RouteCtx<{ itemId: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, updateDesignSheetItemSchema);
  return service.updateDesignSheetItem(user.id, ctx.params.itemId, input);
}

export async function remove(ctx: RouteCtx<{ itemId: string }>) {
  const user = await requireUser(ctx.req);
  return service.deleteDesignSheetItem(user.id, ctx.params.itemId);
}

export async function savePositions(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const input = await parseBody(ctx.req, saveDesignSheetPositionsSchema);
  return service.saveDesignSheetPositions(user.id, ctx.params.id, input);
}
