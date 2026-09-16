import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../../db";

export function listDesignSheetItems(projectId: string, db: Db = prisma) {
  return db.designSheetItem.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
}

export function findDesignSheetItem(id: string, db: Db = prisma) {
  return db.designSheetItem.findUnique({ where: { id } });
}

export function createDesignSheetItem(
  data: Prisma.DesignSheetItemUncheckedCreateInput,
  db: Db = prisma,
) {
  return db.designSheetItem.create({ data });
}

export function updateDesignSheetItem(
  id: string,
  data: Prisma.DesignSheetItemUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.designSheetItem.update({ where: { id }, data });
}

export function deleteDesignSheetItem(id: string, db: Db = prisma) {
  return db.designSheetItem.delete({ where: { id } });
}

export function updateDesignSheetItemPosition(
  item: {
    id: string;
    positionX: number;
    positionY: number;
    width?: number | null;
    height?: number | null;
  },
  projectId: string,
  db: Db,
) {
  return db.designSheetItem.updateMany({
    where: { id: item.id, projectId },
    data: {
      positionX: item.positionX,
      positionY: item.positionY,
      ...(item.width !== undefined ? { width: item.width } : {}),
      ...(item.height !== undefined ? { height: item.height } : {}),
    },
  });
}
