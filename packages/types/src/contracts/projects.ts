import { z } from "zod";
import { ProjectStatus } from "../enums";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  briefText: z.string().max(100_000).nullable().optional(),
  aiEnabled: z.boolean().optional(),
  createExperimentalBranch: z.boolean().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientName: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  aiEnabled: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listActivityQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;
