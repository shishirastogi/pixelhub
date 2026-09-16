import { z } from "zod";
import {
  DeliverableStatus,
  LinkType,
  MatchedBy,
  Priority,
  RequirementStatus,
} from "../enums";

export const listRequirementsQuerySchema = z.object({
  status: z.nativeEnum(RequirementStatus).or(z.literal("ALL")).optional(),
});
export type ListRequirementsQuery = z.infer<typeof listRequirementsQuerySchema>;

export const requirementDeliverableInputSchema = z.object({
  name: z.string().min(1).max(200),
  filePattern: z.string().min(1).max(300),
});

export const createRequirementSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(10_000).nullable().optional(),
  quantity: z.number().int().min(1).max(10_000).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.nativeEnum(Priority).optional(),
  sortOrder: z.number().int().optional(),
  deliverables: z.array(requirementDeliverableInputSchema).max(50).optional(),
});
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

export const updateRequirementSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(10_000).nullable().optional(),
  quantity: z.number().int().min(1).max(10_000).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.nativeEnum(Priority).optional(),
  sortOrder: z.number().int().optional(),
  status: z.nativeEnum(RequirementStatus).optional(),
});
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

export const linkRequirementFileSchema = z.object({
  fileId: z.string().uuid(),
  linkType: z.nativeEnum(LinkType).optional(),
  matchedBy: z.nativeEnum(MatchedBy).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type LinkRequirementFileInput = z.infer<typeof linkRequirementFileSchema>;

export const createDeliverableSchema = z.object({
  name: z.string().min(1).max(200),
  filePatterns: z.array(z.string().min(1).max(300)).min(1).max(50),
});
export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;

export const updateDeliverableSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  filePatterns: z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
  status: z.nativeEnum(DeliverableStatus).optional(),
});
export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;
