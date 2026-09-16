import type { Prisma } from "@prisma/client";
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
} from "@pixelhub/types/contracts/tasks";
import { emit } from "../../activity";
import { AppError } from "../../errors";
import { ALL_ROLES, EDITORS, authorizeProject } from "../../auth/permissions";
import * as repo from "./repo";

export async function listTasks(
  userId: string,
  idOrSlug: string,
  query: ListTasksQuery,
) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  const tasks = await repo.findProjectTasks(project.id, query);

  if (query.group === "board") {
    return {
      TODO: tasks.filter((task) => task.status === "TODO"),
      IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS"),
      DONE: tasks.filter((task) => task.status === "DONE"),
      CANCELLED: tasks.filter((task) => task.status === "CANCELLED"),
    };
  }

  return tasks;
}

export async function createTask(
  userId: string,
  idOrSlug: string,
  input: CreateTaskInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);

  const task = await repo.createTask({
    projectId: project.id,
    title: input.title.trim(),
    description: input.description ?? null,
    source: "MANUAL",
    status: "TODO",
    assigneeId: input.assigneeId ?? null,
    requirementId: input.requirementId ?? null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    checklistJson: input.checklist as unknown as Prisma.InputJsonValue | undefined,
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "task.created",
    entityType: "Task",
    entityId: task.id,
    meta: { source: "MANUAL" },
  });

  return task;
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  const task = await repo.findTask(taskId);
  if (!task) throw AppError.notFound("Task");

  await authorizeProject(userId, task.projectId, EDITORS);

  const updated = await repo.updateTask(taskId, {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    ...(input.requirementId !== undefined
      ? { requirementId: input.requirementId }
      : {}),
    ...(input.dueDate !== undefined
      ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
      : {}),
    ...(input.checklist !== undefined
      ? { checklistJson: input.checklist as unknown as Prisma.InputJsonValue }
      : {}),
  });

  if (input.status !== undefined && input.status !== task.status) {
    await emit({
      projectId: task.projectId,
      actorId: userId,
      type: "task.status_changed",
      entityType: "Task",
      entityId: task.id,
      meta: { status: input.status },
    });
  }

  return updated;
}
