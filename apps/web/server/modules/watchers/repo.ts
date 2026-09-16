import type { Prisma } from "@prisma/client";
import { prisma } from "../../db";

export function createWatcherDevice(
  data: Prisma.WatcherDeviceUncheckedCreateInput,
) {
  return prisma.watcherDevice.create({ data });
}

export function findWatcherDeviceById(id: string) {
  return prisma.watcherDevice.findUnique({ where: { id } });
}

export function revokeWatcherDevice(id: string) {
  return prisma.watcherDevice.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

export function listManifestFiles(projectId: string, branchId: string | null) {
  return prisma.file.findMany({
    where: { projectId, branchId, deletedAt: null },
    select: { path: true, sha256: true },
    orderBy: { path: "asc" },
  });
}
