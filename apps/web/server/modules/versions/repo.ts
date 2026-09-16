import type { FileKind, FileRole, Prisma } from "@prisma/client";
import { prisma, type Db } from "../../db";

export interface VersionFileInput {
  fileId: string;
  path: string;
  role: FileRole;
}

export interface CreateVersionData {
  branchId: string;
  number: number;
  label?: string | null;
  note?: string | null;
  createdById: string;
  checksum: string;
  parentVersionId?: string | null;
  sourceBranchId?: string | null;
  sourceVersionId?: string | null;
  files: VersionFileInput[];
}

const FILE_ROLE_BY_KIND: Record<FileKind, FileRole> = {
  SOURCE: "SOURCE",
  EXPORT: "EXPORT",
  DELIVERABLE: "DELIVERABLE",
  REFERENCE: "ASSET",
  BRAND_ASSET: "ASSET",
  BRIEF_DOC: "ASSET",
  OTHER: "ASSET",
};

export function fileRoleForKind(kind: FileKind): FileRole {
  return FILE_ROLE_BY_KIND[kind];
}

export function createVersion(data: CreateVersionData, db: Db) {
  const record: Prisma.VersionUncheckedCreateInput = {
    branchId: data.branchId,
    number: data.number,
    label: data.label ?? null,
    note: data.note ?? null,
    createdById: data.createdById,
    checksum: data.checksum,
    parentVersionId: data.parentVersionId ?? null,
    sourceBranchId: data.sourceBranchId ?? null,
    sourceVersionId: data.sourceVersionId ?? null,
  };

  if (data.files.length > 0) {
    record.files = { create: data.files };
  }

  return db.version.create({ data: record, include: { files: true } });
}

export function setBranchHead(branchId: string, versionId: string, db: Db) {
  return db.branch.update({
    where: { id: branchId },
    data: { headVersionId: versionId },
  });
}

export function findVersion(id: string, db: Db = prisma) {
  return db.version.findUnique({
    where: { id },
    include: { branch: { select: { id: true, projectId: true } } },
  });
}

export function findVersionWithFiles(id: string, db: Db = prisma) {
  return db.version.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, projectId: true } },
      files: {
        include: {
          file: { select: { id: true, path: true, sha256: true, imageMeta: true } },
        },
        orderBy: { path: "asc" },
      },
    },
  });
}

export function findVersionFilesWithFile(id: string, db: Db = prisma) {
  return db.versionFile.findMany({
    where: { versionId: id },
    include: { file: { select: { id: true, sha256: true } } },
    orderBy: { path: "asc" },
  });
}

export function listVersions(branchId: string) {
  return prisma.version.findMany({
    where: { branchId },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      sourceBranch: { select: { id: true, name: true, kind: true } },
      _count: { select: { files: true } },
    },
    orderBy: { number: "desc" },
  });
}

export function findVersionDetail(id: string) {
  return prisma.version.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, projectId: true, name: true, kind: true, slug: true } },
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      parentVersion: { select: { id: true, number: true, label: true, createdAt: true } },
      sourceBranch: { select: { id: true, name: true, kind: true } },
      sourceVersion: { select: { id: true, number: true, label: true, createdAt: true } },
      files: {
        include: {
          file: {
            select: {
              id: true,
              fileName: true,
              extension: true,
              mimeType: true,
              sizeBytes: true,
              sha256: true,
              storageKey: true,
              kind: true,
              imageMeta: true,
            },
          },
        },
        orderBy: { path: "asc" },
      },
    },
  });
}

export function findComparison(
  baseVersionId: string,
  targetVersionId: string,
  db: Db = prisma,
) {
  return db.versionComparison.findUnique({
    where: { baseVersionId_targetVersionId: { baseVersionId, targetVersionId } },
  });
}

export function createComparison(
  data: Prisma.VersionComparisonUncheckedCreateInput,
  db: Db = prisma,
) {
  return db.versionComparison.create({ data });
}

export function setComparisonJob(comparisonId: string, jobId: string, db: Db = prisma) {
  return db.versionComparison.update({
    where: { id: comparisonId },
    data: { jobId },
  });
}

export function findAiJob(id: string, db: Db = prisma) {
  return db.aiJob.findUnique({
    where: { id },
    select: { id: true, type: true, status: true, resultJson: true, error: true },
  });
}
