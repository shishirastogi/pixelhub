import type { Project, WatcherDevice } from "@prisma/client";
import type { NextRequest } from "next/server";
import { prisma } from "../db";
import { AppError } from "../errors";
import { hashWatcherToken } from "./session";

export function getWatcherToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export async function requireWatcher(
  req: NextRequest,
): Promise<{ device: WatcherDevice; project: Project }> {
  const token = getWatcherToken(req);
  if (!token) throw AppError.unauthorized("Watcher token required");

  const device = await prisma.watcherDevice.findFirst({
    where: { tokenHash: hashWatcherToken(token), revokedAt: null },
    include: { project: true },
  });

  if (!device || device.project.deletedAt) {
    throw AppError.unauthorized("Invalid or revoked watcher token");
  }

  await prisma.watcherDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });

  const { project, ...watcherDevice } = device;
  return { device: watcherDevice, project };
}
