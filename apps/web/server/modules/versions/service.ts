import type { FileRole, Prisma } from "@prisma/client";
import type {
  CompareVersionsInput,
  CreateVersionInput,
} from "@pixelhub/types/contracts/versions";
import { emit } from "../../activity";
import { prisma } from "../../db";
import { AppError } from "../../errors";
import { ALL_ROLES, EDITORS, requireRole } from "../../auth/permissions";
import { enqueueAiJob } from "../ai/queue";
import * as branchRepo from "../branches/repo";
import { computeChecksum } from "./checksum";
import * as repo from "./repo";

interface SnapshotFile {
  fileId: string;
  path: string;
  role: FileRole;
  sha256: string;
}

interface DiffFile {
  fileId: string;
  path: string;
  file: { sha256: string; imageMeta: unknown };
}

interface VersionDiff {
  files: {
    added: { path: string; fileId: string }[];
    removed: { path: string }[];
    modified: { path: string; fromFileId: string; toFileId: string }[];
    renamed: { from: string; to: string; confidence: number }[];
  };
  colors: { dominantBefore: string[]; dominantAfter: string[] };
  typography: { detectedFontsBefore: string[]; detectedFontsAfter: string[] };
  counts: { filesBefore: number; filesAfter: number };
}

function collectFacet(rows: DiffFile[], key: "dominantColors" | "fonts"): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const meta = row.file.imageMeta;
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) continue;
    const facet = (meta as Record<string, unknown>)[key];
    if (!Array.isArray(facet)) continue;
    for (const item of facet) {
      if (typeof item === "string") values.add(item);
    }
  }
  return [...values];
}

function buildVersionDiff(base: DiffFile[], target: DiffFile[]): VersionDiff {
  const baseByPath = new Map(base.map((file) => [file.path, file]));
  const targetByPath = new Map(target.map((file) => [file.path, file]));

  const targetBySha = new Map<string, DiffFile[]>();
  for (const file of target) {
    const list = targetBySha.get(file.file.sha256);
    if (list) list.push(file);
    else targetBySha.set(file.file.sha256, [file]);
  }

  const renamed: { from: string; to: string; confidence: number }[] = [];
  const renamedFrom = new Set<string>();
  const renamedTo = new Set<string>();

  for (const file of base) {
    if (targetByPath.has(file.path)) continue;
    const candidates = targetBySha.get(file.file.sha256) ?? [];
    const candidate = candidates.find(
      (row) => !baseByPath.has(row.path) && !renamedTo.has(row.path),
    );
    if (candidate) {
      renamed.push({ from: file.path, to: candidate.path, confidence: 1 });
      renamedFrom.add(file.path);
      renamedTo.add(candidate.path);
    }
  }

  const added: { path: string; fileId: string }[] = [];
  const removed: { path: string }[] = [];
  const modified: { path: string; fromFileId: string; toFileId: string }[] = [];

  for (const file of base) {
    const counterpart = targetByPath.get(file.path);
    if (counterpart) {
      if (counterpart.file.sha256 !== file.file.sha256) {
        modified.push({
          path: file.path,
          fromFileId: file.fileId,
          toFileId: counterpart.fileId,
        });
      }
    } else if (!renamedFrom.has(file.path)) {
      removed.push({ path: file.path });
    }
  }

  for (const file of target) {
    if (baseByPath.has(file.path) || renamedTo.has(file.path)) continue;
    added.push({ path: file.path, fileId: file.fileId });
  }

  return {
    files: { added, removed, modified, renamed },
    colors: {
      dominantBefore: collectFacet(base, "dominantColors"),
      dominantAfter: collectFacet(target, "dominantColors"),
    },
    typography: {
      detectedFontsBefore: collectFacet(base, "fonts"),
      detectedFontsAfter: collectFacet(target, "fonts"),
    },
    counts: { filesBefore: base.length, filesAfter: target.length },
  };
}

export async function listVersions(userId: string, branchId: string) {
  const branch = await branchRepo.findBranch(branchId);
  if (!branch || branch.deletedAt) throw AppError.notFound("Branch");
  await requireRole(userId, branch.projectId, ALL_ROLES);

  const versions = await repo.listVersions(branch.id);
  return versions.map((version) => ({
    ...version,
    fileCount: version._count.files,
    _count: undefined,
  }));
}

export async function createVersion(
  userId: string,
  branchId: string,
  input: CreateVersionInput,
) {
  const branch = await branchRepo.findBranch(branchId);
  if (!branch || branch.deletedAt) throw AppError.notFound("Branch");
  await requireRole(userId, branch.projectId, EDITORS);

  const versionId = await prisma.$transaction(async (tx) => {
    let snapshot: SnapshotFile[];

    if (input.restoreFrom) {
      const source = await repo.findVersionWithFiles(input.restoreFrom, tx);
      if (!source || source.branchId !== branch.id) throw AppError.notFound("Version");
      snapshot = source.files.map((versionFile) => ({
        fileId: versionFile.fileId,
        path: versionFile.path,
        role: versionFile.role,
        sha256: versionFile.file.sha256,
      }));
    } else {
      const live = await branchRepo.findLiveBranchFiles(branch.id, undefined, tx);
      snapshot = live.map((file) => ({
        fileId: file.id,
        path: file.path,
        role: repo.fileRoleForKind(file.kind),
        sha256: file.sha256,
      }));
    }

    const checksum = computeChecksum(
      snapshot.map((file) => ({ path: file.path, sha256: file.sha256 })),
    );

    const fresh = await branchRepo.findBranch(branch.id, tx);
    const head = fresh?.headVersion ?? null;
    if (head && head.checksum === checksum) {
      throw AppError.conflict("NO_CHANGES", `No changes since v${head.number}`);
    }

    const version = await repo.createVersion(
      {
        branchId: branch.id,
        number: (head?.number ?? 0) + 1,
        label: input.label ?? null,
        note: input.note ?? null,
        createdById: userId,
        checksum,
        parentVersionId: fresh?.headVersionId ?? null,
        files: snapshot.map((file) => ({
          fileId: file.fileId,
          path: file.path,
          role: file.role,
        })),
      },
      tx,
    );

    await repo.setBranchHead(branch.id, version.id, tx);

    await emit(
      {
        projectId: branch.projectId,
        actorId: userId,
        type: "version.created",
        entityType: "Version",
        entityId: version.id,
        meta: { branchId: branch.id, number: version.number, fileCount: snapshot.length },
      },
      tx,
    );

    return version.id;
  });

  return repo.findVersionDetail(versionId);
}

export async function getVersion(userId: string, versionId: string) {
  const version = await repo.findVersion(versionId);
  if (!version) throw AppError.notFound("Version");
  await requireRole(userId, version.branch.projectId, ALL_ROLES);

  const detail = await repo.findVersionDetail(version.id);
  if (!detail) throw AppError.notFound("Version");
  return detail;
}

export async function compareVersions(userId: string, input: CompareVersionsInput) {
  const [base, target] = await Promise.all([
    repo.findVersionWithFiles(input.baseVersionId),
    repo.findVersionWithFiles(input.targetVersionId),
  ]);
  if (!base) throw AppError.notFound("Version");
  if (!target) throw AppError.notFound("Version");
  if (base.branch.projectId !== target.branch.projectId) {
    throw AppError.badRequest(
      "VERSION_PROJECT_MISMATCH",
      "Versions belong to different projects",
    );
  }
  await requireRole(userId, base.branch.projectId, ALL_ROLES);

  const existing = await repo.findComparison(base.id, target.id);
  if (existing) {
    return {
      jobId: existing.jobId,
      comparisonId: existing.id,
      comparison: existing,
    };
  }

  const diffJson = buildVersionDiff(base.files, target.files);
  const comparison = await repo.createComparison({
    projectId: base.branch.projectId,
    baseVersionId: base.id,
    targetVersionId: target.id,
    diffJson: diffJson as unknown as Prisma.InputJsonValue,
  });

  const { id: jobId } = await enqueueAiJob({
    projectId: base.branch.projectId,
    type: "COMPARE_VERSIONS",
    input: {
      comparisonId: comparison.id,
      baseVersionId: base.id,
      targetVersionId: target.id,
    },
    requestedById: userId,
  });

  await repo.setComparisonJob(comparison.id, jobId);

  return {
    jobId,
    comparisonId: comparison.id,
    comparison: { ...comparison, jobId },
  };
}

export async function getComparisonJob(jobId: string) {
  const job = await repo.findAiJob(jobId);
  if (!job) throw AppError.notFound("AiJob");
  return job;
}
