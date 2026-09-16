import { z } from "zod";
import { DecisionStatus } from "../enums";

export const createDecisionSchema = z.object({
  title: z.string().min(1).max(300),
  decision: z.string().min(1).max(20_000),
  reason: z.string().min(1).max(20_000),
  status: z.nativeEnum(DecisionStatus).optional(),
  versionId: z.string().uuid().nullable().optional(),
  designSheetItemId: z.string().uuid().nullable().optional(),
});
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;

export const updateDecisionSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  decision: z.string().min(1).max(20_000).optional(),
  reason: z.string().min(1).max(20_000).optional(),
  status: z.nativeEnum(DecisionStatus).optional(),
  versionId: z.string().uuid().nullable().optional(),
  designSheetItemId: z.string().uuid().nullable().optional(),
  supersedesId: z.string().uuid().nullable().optional(),
});
export type UpdateDecisionInput = z.infer<typeof updateDecisionSchema>;

export const listDecisionsQuerySchema = z.object({
  status: z.nativeEnum(DecisionStatus).optional(),
});
export type ListDecisionsQuery = z.infer<typeof listDecisionsQuerySchema>;
