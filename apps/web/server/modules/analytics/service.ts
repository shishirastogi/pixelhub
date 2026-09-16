import type { Prisma } from "@prisma/client";
import type {
  AiMetrics,
  AnalyticsMetrics,
  CollaborationMetrics,
  DesignMetrics,
  FileMetrics,
  RequirementAnalytics,
  RequirementMetrics,
  VersionMetrics,
} from "@pixelhub/types/contracts/analytics";
import { emit } from "../../activity";
import { prisma } from "../../db";
import {
  ALL_ROLES,
  authorizeProject,
} from "../../auth/permissions";
import * as repo from "./repo";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid];
  if (hi === undefined) return null;
  if (sorted.length % 2 === 1) return hi;
  const lo = sorted[mid - 1];
  return lo === undefined ? hi : (lo + hi) / 2;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === "") {
    return false;
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function diffHasChange(value: unknown, pattern: RegExp, key = ""): boolean {
  if (key.length > 0 && pattern.test(key) && isMeaningful(value)) return true;
  if (Array.isArray(value)) {
    return value.some((item) => diffHasChange(item, pattern));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([k, v]) =>
      diffHasChange(v, pattern, k),
    );
  }
  return false;
}

async function computeVersionMetrics(projectId: string): Promise<VersionMetrics> {
  const [branches, mergesLast7d] = await Promise.all([
    repo.findBranchVersions(projectId),
    repo.countMergesSince(projectId, new Date(Date.now() - 7 * DAY_MS)),
  ]);

  let branchCount = 0;
  let totalVersions = 0;
  const gaps: number[] = [];
  const perBranch: VersionMetrics["perBranch"] = [];

  for (const branch of branches) {
    totalVersions += branch.versions.length;
    if (branch.status === "ACTIVE") branchCount += 1;

    for (let i = 1; i < branch.versions.length; i += 1) {
      const prev = branch.versions[i - 1];
      const curr = branch.versions[i];
      if (prev && curr) {
        gaps.push((curr.createdAt.getTime() - prev.createdAt.getTime()) / DAY_MS);
      }
    }

    perBranch.push({
      branchId: branch.id,
      name: branch.name,
      versions: branch.versions.length,
    });
  }

  return {
    branchCount,
    totalVersions,
    avgIntervalDays: gaps.length > 0 ? round(average(gaps), 2) : null,
    mergesLast7d,
    perBranch,
  };
}

async function computeRequirementMetrics(
  projectId: string,
): Promise<RequirementMetrics> {
  const requirements = await repo.findRequirements(projectId);
  const now = Date.now();

  const fulfilled = requirements.filter((r) => r.status === "FULFILLED").length;
  const accepted = requirements.filter(
    (r) => r.status === "ACCEPTED" || r.status === "FULFILLED",
  ).length;
  const coveragePct = accepted > 0 ? Math.round((fulfilled / accepted) * 100) : 0;

  const totalLinks = requirements.reduce(
    (sum, r) => sum + r._count.fileLinks,
    0,
  );
  const avgRevisions =
    requirements.length > 0 ? round(totalLinks / requirements.length, 2) : 0;

  const overdue = requirements.filter(
    (r) => r.status === "ACCEPTED" && r.dueDate !== null && r.dueDate.getTime() < now,
  ).length;

  return { fulfilled, accepted, coveragePct, avgRevisions, overdue };
}

async function computeFileMetrics(projectId: string): Promise<FileMetrics> {
  const [files, deliverableGroups, outdatedCount] = await Promise.all([
    repo.findFiles(projectId),
    repo.groupDeliverablesByStatus(projectId),
    repo.countOutdatedAssets(projectId),
  ]);

  const typeDistribution: Record<string, number> = {};
  const shaCounts = new Map<string, number>();
  const bytesByKind = new Map<string, bigint>();

  for (const file of files) {
    typeDistribution[file.extension] =
      (typeDistribution[file.extension] ?? 0) + 1;
    shaCounts.set(file.sha256, (shaCounts.get(file.sha256) ?? 0) + 1);
    bytesByKind.set(
      file.kind,
      (bytesByKind.get(file.kind) ?? 0n) + file.sizeBytes,
    );
  }

  let duplicates = 0;
  for (const count of shaCounts.values()) {
    if (count > 1) duplicates += 1;
  }

  let required = 0;
  let produced = 0;
  for (const group of deliverableGroups) {
    required += group._count._all;
    if (group.status === "SATISFIED") produced += group._count._all;
  }

  const storageByKind = [...bytesByKind.entries()].map(([kind, bytes]) => ({
    kind,
    bytes: Number(bytes),
  }));

  return {
    total: files.length,
    produced,
    required,
    duplicates,
    typeDistribution,
    outdatedCount,
    storageByKind,
  };
}

async function computeCollaborationMetrics(
  projectId: string,
): Promise<CollaborationMetrics> {
  const [actors, comments, converted, approved] = await Promise.all([
    repo.listActiveActors(projectId, new Date(Date.now() - 30 * DAY_MS)),
    repo.countComments(projectId),
    repo.findConvertedComments(projectId),
    repo.findApprovedBranches(projectId),
  ]);

  const durations: number[] = [];
  for (const comment of converted) {
    if (comment.convertedTask && comment.convertedTask.status === "DONE") {
      durations.push(
        comment.convertedTask.updatedAt.getTime() - comment.createdAt.getTime(),
      );
    }
  }
  const medianMs = median(durations);
  const avgReviewTurnaroundH =
    medianMs === null ? null : round(medianMs / HOUR_MS, 2);

  const approvalIterations =
    approved.length > 0
      ? round(
          average(approved.map((branch) => branch._count.versions)),
          2,
        )
      : null;

  return {
    activeContributors: actors.length,
    comments,
    avgReviewTurnaroundH,
    approvalIterations,
  };
}

async function computeDesignMetrics(projectId: string): Promise<DesignMetrics> {
  const comparisons = await repo.findVersionComparisons(projectId);

  let colorChangeCount = 0;
  let fontChangeCount = 0;
  let layoutChangeCount = 0;

  for (const comparison of comparisons) {
    const diff = comparison.diffJson as unknown;
    if (diffHasChange(diff, /color/i)) colorChangeCount += 1;
    if (diffHasChange(diff, /font|typograph/i)) fontChangeCount += 1;
    if (diffHasChange(diff, /layout|dimension|position/i)) layoutChangeCount += 1;
  }

  return { colorChangeCount, fontChangeCount, layoutChangeCount };
}

async function computeAiMetrics(projectId: string): Promise<AiMetrics> {
  const aggregate = await repo.aggregateAiJobs(projectId);
  const tokensIn = aggregate._sum.tokensIn ?? 0;
  const tokensOut = aggregate._sum.tokensOut ?? 0;
  const estCostUsd = round((tokensIn / 1_000_000) * 3 + (tokensOut / 1_000_000) * 15, 4);

  return {
    jobsRun: aggregate._count._all,
    tokensIn,
    tokensOut,
    estCostUsd,
  };
}

export async function computeMetrics(projectId: string): Promise<AnalyticsMetrics> {
  const [versions, requirements, files, collaboration, design, ai] =
    await Promise.all([
      computeVersionMetrics(projectId),
      computeRequirementMetrics(projectId),
      computeFileMetrics(projectId),
      computeCollaborationMetrics(projectId),
      computeDesignMetrics(projectId),
      computeAiMetrics(projectId),
    ]);

  return { versions, requirements, files, collaboration, design, ai };
}

export async function getVersionAnalytics(
  userId: string,
  idOrSlug: string,
): Promise<VersionMetrics> {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return computeVersionMetrics(project.id);
}

export async function getRequirementAnalytics(
  userId: string,
  idOrSlug: string,
): Promise<RequirementAnalytics> {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  const [metrics, snapshots] = await Promise.all([
    computeRequirementMetrics(project.id),
    repo.findRecentSnapshots(project.id, 30),
  ]);

  const trend = [...snapshots].reverse().map((snapshot) => {
    const stored = snapshot.metrics as unknown as Partial<AnalyticsMetrics>;
    return {
      date: snapshot.date.toISOString().slice(0, 10),
      coveragePct: stored.requirements?.coveragePct ?? 0,
    };
  });

  return { ...metrics, trend };
}

export async function getFileAnalytics(
  userId: string,
  idOrSlug: string,
): Promise<FileMetrics> {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return computeFileMetrics(project.id);
}

export async function getCollaborationAnalytics(
  userId: string,
  idOrSlug: string,
): Promise<CollaborationMetrics> {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return computeCollaborationMetrics(project.id);
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function recompute(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  const metrics = await computeMetrics(project.id);
  const date = todayDateOnly();

  return prisma.$transaction(async (tx) => {
    const snapshot = await repo.upsertSnapshot(
      project.id,
      date,
      metrics as unknown as Prisma.InputJsonValue,
      tx,
    );

    await emit(
      {
        projectId: project.id,
        actorId: userId,
        type: "analytics.recomputed",
        entityType: "AnalyticsSnapshot",
        entityId: snapshot.id,
        meta: { date: snapshot.date.toISOString().slice(0, 10) },
      },
      tx,
    );

    return snapshot;
  });
}
