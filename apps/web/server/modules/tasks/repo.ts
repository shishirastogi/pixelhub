import type { Prisma } from "@prisma/client";
import type { ListTasksQuery } from "@pixelhub/types/contracts/tasks";
import { prisma, type Db } from "../../db";

const taskInclude = {
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  requirement: { select: { id: true, title: true } },
} as const;

export function findProjectTasks(projectId: string, filters: ListTasksQuery) {
  return prisma.task.findMany({
    where: {
      projectId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.requirementId ? { requirementId: filters.requirementId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: taskInclude,
  });
}

export function findTask(id: string) {
  return prisma.task.findUnique({ where: { id }, include: taskInclude });
}

export function createTask(data: Prisma.TaskUncheckedCreateInput, db: Db = prisma) {
  return db.task.create({ data, include: taskInclude });
}

export function updateTask(id: string, data: Prisma.TaskUncheckedUpdateInput) {
  return prisma.task.update({ where: { id }, data, include: taskInclude });
}
