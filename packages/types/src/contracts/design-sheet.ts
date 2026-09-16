import { z } from "zod";
import { DesignSheetItemType } from "../enums";

export const createDesignSheetItemSchema = z.object({
  type: z.nativeEnum(DesignSheetItemType),
  title: z.string().max(300).nullable().optional(),
  content: z.string().max(50_000).nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
  positionX: z.number().finite().optional(),
  positionY: z.number().finite().optional(),
  width: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
  boardGroup: z.string().max(200).nullable().optional(),
  linkedDecisionId: z.string().uuid().nullable().optional(),
  linkedRequirementId: z.string().uuid().nullable().optional(),
});
export type CreateDesignSheetItemInput = z.infer<
  typeof createDesignSheetItemSchema
>;

export const updateDesignSheetItemSchema = z.object({
  title: z.string().max(300).nullable().optional(),
  content: z.string().max(50_000).nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
  positionX: z.number().finite().optional(),
  positionY: z.number().finite().optional(),
  width: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
  boardGroup: z.string().max(200).nullable().optional(),
  linkedDecisionId: z.string().uuid().nullable().optional(),
  linkedRequirementId: z.string().uuid().nullable().optional(),
});
export type UpdateDesignSheetItemInput = z.infer<
  typeof updateDesignSheetItemSchema
>;

export const saveDesignSheetPositionsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        positionX: z.number().finite(),
        positionY: z.number().finite(),
        width: z.number().positive().nullable().optional(),
        height: z.number().positive().nullable().optional(),
      }),
    )
    .min(1)
    .max(1000),
});
export type SaveDesignSheetPositionsInput = z.infer<
  typeof saveDesignSheetPositionsSchema
>;
