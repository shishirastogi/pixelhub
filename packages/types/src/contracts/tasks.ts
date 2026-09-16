import { z } from "zod";
import { TaskStatus } from "../enums";

export const checklistItemSchema = z.union([
  z.string().min(1).max(1000),
  z.object({
    text: z.string().min(1).max(1000),
    done: z.boolean().optional(),
  }),
]);
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20_000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  requirementId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  checklist: z.array(checklistItemSchema).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20_000).nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  requirementId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  checklist: z.array(checklistItemSchema).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const listTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().uuid().optional(),
  requirementId: z.string().uuid().optional(),
  group: z.enum(["board"]).optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
