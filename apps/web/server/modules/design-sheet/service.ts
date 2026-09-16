import type { Prisma } from "@prisma/client";
import type {
  CreateDesignSheetItemInput,
  SaveDesignSheetPositionsInput,
  UpdateDesignSheetItemInput,
} from "@pixelhub/types/contracts/design-sheet";
import { emit } from "../../activity";
import { prisma } from "../../db";
import { AppError } from "../../errors";
import { ALL_ROLES, EDITORS, authorizeProject } from "../../auth/permissions";
import * as repo from "./repo";

export async function listDesignSheetItems(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return repo.listDesignSheetItems(project.id);
}

export async function createDesignSheetItem(
  userId: string,
  idOrSlug: string,
  input: CreateDesignSheetItemInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);

  const item = await repo.createDesignSheetItem({
    projectId: project.id,
    type: input.type,
    title: input.title ?? null,
    content: input.content ?? null,
    fileId: input.fileId ?? null,
    ...(input.positionX !== undefined ? { positionX: input.positionX } : {}),
    ...(input.positionY !== undefined ? { positionY: input.positionY } : {}),
    width: input.width ?? null,
    height: input.height ?? null,
    boardGroup: input.boardGroup ?? null,
    linkedDecisionId: input.linkedDecisionId ?? null,
    linkedRequirementId: input.linkedRequirementId ?? null,
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "design_sheet.item_created",
    entityType: "DesignSheetItem",
    entityId: item.id,
    meta: { type: item.type },
  });

  return item;
}

export async function updateDesignSheetItem(
  userId: string,
  itemId: string,
  input: UpdateDesignSheetItemInput,
) {
  const existing = await repo.findDesignSheetItem(itemId);
  if (!existing) throw AppError.notFound("DesignSheetItem");

  await authorizeProject(userId, existing.projectId, EDITORS);

  const item = await repo.updateDesignSheetItem(itemId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.fileId !== undefined ? { fileId: input.fileId } : {}),
    ...(input.positionX !== undefined ? { positionX: input.positionX } : {}),
    ...(input.positionY !== undefined ? { positionY: input.positionY } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    ...(input.boardGroup !== undefined ? { boardGroup: input.boardGroup } : {}),
    ...(input.linkedDecisionId !== undefined
      ? { linkedDecisionId: input.linkedDecisionId }
      : {}),
    ...(input.linkedRequirementId !== undefined
      ? { linkedRequirementId: input.linkedRequirementId }
      : {}),
  });

  await emit({
    projectId: existing.projectId,
    actorId: userId,
    type: "design_sheet.item_updated",
    entityType: "DesignSheetItem",
    entityId: item.id,
    meta: input as Prisma.InputJsonValue,
  });

  return item;
}

export async function deleteDesignSheetItem(userId: string, itemId: string) {
  const existing = await repo.findDesignSheetItem(itemId);
  if (!existing) throw AppError.notFound("DesignSheetItem");

  await authorizeProject(userId, existing.projectId, EDITORS);
  await repo.deleteDesignSheetItem(itemId);

  await emit({
    projectId: existing.projectId,
    actorId: userId,
    type: "design_sheet.item_deleted",
    entityType: "DesignSheetItem",
    entityId: itemId,
  });

  return { ok: true };
}

export async function saveDesignSheetPositions(
  userId: string,
  idOrSlug: string,
  input: SaveDesignSheetPositionsInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);

  const updated = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const item of input.items) {
      const result = await repo.updateDesignSheetItemPosition(item, project.id, tx);
      count += result.count;
    }

    await emit(
      {
        projectId: project.id,
        actorId: userId,
        type: "design_sheet.positions_saved",
        entityType: "Project",
        entityId: project.id,
        meta: { updated: count },
      },
      tx,
    );

    return count;
  });

  return { updated };
}
