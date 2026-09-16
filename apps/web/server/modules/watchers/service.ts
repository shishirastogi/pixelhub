import { randomInt } from "node:crypto";
import type { Project } from "@prisma/client";
import type { ExchangeWatcherInput } from "@pixelhub/types/contracts/watchers";
import { emit } from "../../activity";
import { prisma } from "../../db";
import { AppError } from "../../errors";
import { generateToken, hashWatcherToken } from "../../auth/session";
import { OWNER_ONLY, requireRole } from "../../auth/permissions";
import * as repo from "./repo";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_IGNORE_RULES = [
  ".git",
  "node_modules",
  ".pixelhub",
  "*.tmp",
  "~$*",
  ".DS_Store",
  "Thumbs.db",
];

interface PairingEntry {
  projectId: string;
  userId: string;
  expiresAt: number;
}

// TODO: move pairing codes to Redis so they survive restarts / multi-instance deploys.
const pairingCodes = new Map<string, PairingEntry>();

function generatePairingCode(): string {
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
  }
  return code;
}

export async function createPairingCode(project: Project, userId: string) {
  let code = generatePairingCode();
  while (pairingCodes.has(code)) code = generatePairingCode();

  const expiresAt = Date.now() + PAIRING_TTL_MS;
  pairingCodes.set(code, { projectId: project.id, userId, expiresAt });
  return { code, expiresAt: new Date(expiresAt) };
}

export async function exchangeWatcher(input: ExchangeWatcherInput) {
  const code = input.code.trim().toUpperCase();
  const entry = pairingCodes.get(code);

  if (!entry || entry.expiresAt < Date.now()) {
    pairingCodes.delete(code);
    throw AppError.badRequest(
      "INVALID_PAIRING_CODE",
      "Pairing code is invalid or expired",
    );
  }
  pairingCodes.delete(code);

  const project = await prisma.project.findFirst({
    where: { id: entry.projectId, deletedAt: null },
  });
  if (!project) throw AppError.notFound("Project");

  const token = generateToken();
  await repo.createWatcherDevice({
    projectId: project.id,
    name: input.deviceName.trim(),
    tokenHash: hashWatcherToken(token),
    pairedByUserId: entry.userId,
  });

  return {
    watcherToken: token,
    projectId: project.id,
    projectSlug: project.slug,
    serverConfig: { apiBase: "/api/v1" },
  };
}

export async function getWatcherConfig(project: Project) {
  const manifest = await repo.listManifestFiles(project.id, project.defaultBranchId);
  return {
    projectId: project.id,
    projectSlug: project.slug,
    branchId: project.defaultBranchId,
    ignoreRules: [...DEFAULT_IGNORE_RULES],
    manifest,
  };
}

export async function revokeWatcher(userId: string, watcherId: string) {
  const device = await repo.findWatcherDeviceById(watcherId);
  if (!device) throw AppError.notFound("WatcherDevice");

  await requireRole(userId, device.projectId, OWNER_ONLY);
  await repo.revokeWatcherDevice(device.id);

  await emit({
    projectId: device.projectId,
    actorId: userId,
    type: "watcher.revoked",
    entityType: "WatcherDevice",
    entityId: device.id,
    meta: { name: device.name },
  });

  return { ok: true };
}
