import type { NextRequest } from "next/server";
import type { Project } from "@prisma/client";
import {
  confirmFileSchema,
  ingestFilesSchema,
  listFilesQuerySchema,
  uploadUrlSchema,
} from "@pixelhub/types/contracts/files";
import { AppError } from "../../errors";
import { parseBody, parseQuery, type RouteCtx } from "../../http";
import { requireUser } from "../../auth/session";
import {
  ALL_ROLES,
  EDITORS,
  authorizeProject,
  resolveProject,
} from "../../auth/permissions";
import { getWatcherToken, requireWatcher } from "../../auth/watcher";
import type { FileActor } from "./service";
import * as service from "./service";

async function projectActor(
  req: NextRequest,
  idOrSlug: string,
): Promise<{ project: Project; actor: FileActor }> {
  if (getWatcherToken(req)) {
    const { device, project } = await requireWatcher(req);
    const resolved = await resolveProject(idOrSlug);
    if (resolved.id !== project.id) {
      throw AppError.forbidden(
        "WATCHER_PROJECT_MISMATCH",
        "Watcher token is not valid for this project",
      );
    }
    return { project, actor: { userId: null, watcherDeviceId: device.id } };
  }

  const user = await requireUser(req);
  const { project } = await authorizeProject(user.id, idOrSlug, EDITORS);
  return { project, actor: { userId: user.id, watcherDeviceId: null } };
}

export async function ingest(ctx: RouteCtx<{ id: string }>) {
  const input = await parseBody(ctx.req, ingestFilesSchema);
  const { project, actor } = await projectActor(ctx.req, ctx.params.id);
  return service.ingestFiles(project, input, actor);
}

export async function uploadUrl(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const { project } = await authorizeProject(user.id, ctx.params.id, EDITORS);
  const input = await parseBody(ctx.req, uploadUrlSchema);
  return service.createUploadUrl(project, input);
}

export async function confirm(ctx: RouteCtx<{ id: string }>) {
  const input = await parseBody(ctx.req, confirmFileSchema);
  const { project, actor } = await projectActor(ctx.req, ctx.params.id);
  return service.confirmFile(project, input, actor);
}

export async function list(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  const { project } = await authorizeProject(user.id, ctx.params.id, ALL_ROLES);
  const query = parseQuery(ctx.req, listFilesQuerySchema);
  return service.listFiles(project, query);
}

export async function get(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getFile(user.id, ctx.params.id);
}

export async function remove(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.deleteFile(user.id, ctx.params.id);
}

export async function download(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.getDownloadUrl(user.id, ctx.params.id);
}

export async function recheckBrand(ctx: RouteCtx<{ id: string }>) {
  const user = await requireUser(ctx.req);
  return service.recheckBrand(user.id, ctx.params.id);
}
