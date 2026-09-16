import { exchangeWatcherSchema } from "@pixelhub/types/contracts/watchers";
import { OWNER_ONLY, authorizeProject } from "../../auth/permissions";
import { requireUser } from "../../auth/session";
import { requireWatcher } from "../../auth/watcher";
import { parseBody, type RouteCtx } from "../../http";
import * as service from "./service";

export async function pair(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const { project } = await authorizeProject(user.id, ctx.params.id, OWNER_ONLY);
  return service.createPairingCode(project, user.id);
}

export async function exchange(ctx: RouteCtx) {
  const input = await parseBody(ctx.req, exchangeWatcherSchema);
  return service.exchangeWatcher(input);
}

export async function config(ctx: RouteCtx) {
  const { project } = await requireWatcher(ctx.req);
  return service.getWatcherConfig(project);
}

export async function remove(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.revokeWatcher(user.id, ctx.params.id);
}
