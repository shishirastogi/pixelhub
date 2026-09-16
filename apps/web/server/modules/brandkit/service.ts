import type { Prisma } from "@prisma/client";
import { Role } from "@pixelhub/types";
import type {
  ListBrandChecksQuery,
  ResolveBrandCheckInput,
  RunBrandCheckInput,
  SaveBrandKitInput,
} from "@pixelhub/types/contracts/brandkit";
import { emit } from "../../activity";
import { prisma } from "../../db";
import { AppError } from "../../errors";
import {
  ALL_ROLES,
  EDITORS,
  authorizeProject,
  requireRole,
  resolveProject,
} from "../../auth/permissions";
import { enqueueAiJob } from "../ai/queue";
import * as repo from "./repo";

const CHECK_ROLES: readonly Role[] = [Role.OWNER, Role.CONTRIBUTOR, Role.REVIEWER];

export async function getBrandKit(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return repo.findBrandKit(project.id);
}

export async function saveBrandKit(
  userId: string,
  idOrSlug: string,
  input: SaveBrandKitInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);

  await prisma.$transaction(async (tx) => {
    const kit = await repo.upsertBrandKit(
      project.id,
      {
        name: input.name.trim(),
        guidelinesText: input.guidelinesText ?? null,
        styleGuideFileId: input.styleGuideFileId ?? null,
      },
      tx,
    );

    await repo.deleteBrandKitChildren(kit.id, tx);

    if (input.colors?.length) {
      await repo.createBrandColors(
        input.colors.map((color) => ({
          brandKitId: kit.id,
          name: color.name,
          hex: color.hex,
          role: color.role,
          tolerance: color.tolerance ?? 10,
        })),
        tx,
      );
    }

    if (input.fonts?.length) {
      await repo.createBrandFonts(
        input.fonts.map((font) => ({
          brandKitId: kit.id,
          family: font.family,
          role: font.role,
          fallbacks: font.fallbacks ?? [],
          sourceUrl: font.sourceUrl ?? null,
          fileId: font.fileId ?? null,
        })),
        tx,
      );
    }

    if (input.logos?.length) {
      await repo.createBrandLogos(
        input.logos.map((logo) => ({
          brandKitId: kit.id,
          name: logo.name,
          variant: logo.variant,
          fileId: logo.fileId,
          isCurrent: logo.isCurrent ?? true,
        })),
        tx,
      );
    }

    if (input.rules?.length) {
      await repo.createBrandRules(
        input.rules.map((rule) => ({
          brandKitId: kit.id,
          ruleType: rule.ruleType,
          payload: (rule.payload ?? {}) as Prisma.InputJsonValue,
          severity: rule.severity ?? "WARNING",
        })),
        tx,
      );
    }

    await emit(
      {
        projectId: project.id,
        actorId: userId,
        type: "brandkit.updated",
        entityType: "BrandKit",
        entityId: kit.id,
        meta: {
          colors: input.colors?.length ?? 0,
          fonts: input.fonts?.length ?? 0,
          logos: input.logos?.length ?? 0,
          rules: input.rules?.length ?? 0,
        },
      },
      tx,
    );
  });

  return repo.findBrandKit(project.id);
}

export async function runBrandCheck(
  userId: string,
  idOrSlug: string,
  input: RunBrandCheckInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, CHECK_ROLES);

  let fileIds = input.fileIds ?? [];
  if (fileIds.length === 0) {
    const files = await repo.findLiveFileIds(project.id);
    fileIds = files.map((file) => file.id);
  }

  const { id } = await enqueueAiJob({
    projectId: project.id,
    type: "BRAND_CHECK",
    input: { fileIds },
    requestedById: userId,
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "brand_check.requested",
    entityType: "AiJob",
    entityId: id,
    meta: { fileCount: fileIds.length },
  });

  return { jobId: id };
}

export async function listBrandChecks(
  userId: string,
  idOrSlug: string,
  query: ListBrandChecksQuery,
) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return repo.listBrandChecks(project.id, {
    status: query.status,
    severity: query.severity,
    resolved:
      query.resolved === undefined ? undefined : query.resolved === "true",
    cursor: query.cursor,
    limit: query.limit ?? 50,
  });
}

export async function resolveBrandCheck(
  userId: string,
  id: string,
  input: ResolveBrandCheckInput,
) {
  const check = await repo.findBrandCheck(id);
  if (!check) throw AppError.notFound("BrandCheck");

  const project = await resolveProject(check.projectId);
  await requireRole(userId, project.id, EDITORS);

  const updated = await repo.resolveBrandCheck(id);

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "brand_check.resolved",
    entityType: "BrandCheckResult",
    entityId: id,
    meta: input.note ? { note: input.note } : {},
  });

  return updated;
}
