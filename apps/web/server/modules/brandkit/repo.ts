import type { Prisma } from "@prisma/client";
import type { CheckStatus, Severity } from "@pixelhub/types";
import { prisma, type Db } from "../../db";

export interface BrandCheckListParams {
  status?: CheckStatus;
  severity?: Severity;
  resolved?: boolean;
  cursor?: string;
  limit: number;
}

const kitInclude = {
  colors: true,
  fonts: true,
  logos: true,
  rules: true,
} satisfies Prisma.BrandKitInclude;

export function findBrandKit(projectId: string, db: Db = prisma) {
  return db.brandKit.findUnique({ where: { projectId }, include: kitInclude });
}

export function upsertBrandKit(
  projectId: string,
  data: {
    name: string;
    guidelinesText: string | null;
    styleGuideFileId: string | null;
  },
  db: Db,
) {
  return db.brandKit.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
    select: { id: true },
  });
}

export async function deleteBrandKitChildren(brandKitId: string, db: Db) {
  await db.brandColor.deleteMany({ where: { brandKitId } });
  await db.brandFont.deleteMany({ where: { brandKitId } });
  await db.brandLogo.deleteMany({ where: { brandKitId } });
  await db.brandRule.deleteMany({ where: { brandKitId } });
}

export function createBrandColors(
  data: Prisma.BrandColorCreateManyInput[],
  db: Db,
) {
  if (data.length === 0) return Promise.resolve();
  return db.brandColor.createMany({ data });
}

export function createBrandFonts(
  data: Prisma.BrandFontCreateManyInput[],
  db: Db,
) {
  if (data.length === 0) return Promise.resolve();
  return db.brandFont.createMany({ data });
}

export function createBrandLogos(
  data: Prisma.BrandLogoCreateManyInput[],
  db: Db,
) {
  if (data.length === 0) return Promise.resolve();
  return db.brandLogo.createMany({ data });
}

export function createBrandRules(
  data: Prisma.BrandRuleCreateManyInput[],
  db: Db,
) {
  if (data.length === 0) return Promise.resolve();
  return db.brandRule.createMany({ data });
}

export function findLiveFileIds(projectId: string, db: Db = prisma) {
  return db.file.findMany({
    where: { projectId, deletedAt: null, kind: { in: ["EXPORT", "DELIVERABLE"] } },
    select: { id: true },
  });
}

export async function listBrandChecks(
  projectId: string,
  query: BrandCheckListParams,
) {
  const rows = await prisma.brandCheckResult.findMany({
    where: {
      projectId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity
        ? {
            findings: {
              array_contains: [{ severity: query.severity }] as Prisma.InputJsonValue,
            },
          }
        : {}),
      ...(query.resolved === undefined
        ? {}
        : query.resolved
          ? { resolvedAt: { not: null } }
          : { resolvedAt: null }),
    },
    orderBy: { createdAt: "desc" },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: { file: { select: { id: true, fileName: true, path: true } } },
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
  return { items, nextCursor };
}

export function findBrandCheck(id: string, db: Db = prisma) {
  return db.brandCheckResult.findUnique({
    where: { id },
    include: { file: { select: { id: true, fileName: true, path: true } } },
  });
}

export function resolveBrandCheck(id: string, db: Db = prisma) {
  return db.brandCheckResult.update({
    where: { id },
    data: { resolvedAt: new Date() },
    include: { file: { select: { id: true, fileName: true, path: true } } },
  });
}
