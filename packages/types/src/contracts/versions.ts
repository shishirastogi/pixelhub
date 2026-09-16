import { z } from "zod";

export const createVersionSchema = z.object({
  label: z.string().max(200).nullable().optional(),
  note: z.string().max(5000).nullable().optional(),
  restoreFrom: z.string().uuid().optional(),
});
export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export const compareVersionsSchema = z.object({
  baseVersionId: z.string().uuid(),
  targetVersionId: z.string().uuid(),
});
export type CompareVersionsInput = z.infer<typeof compareVersionsSchema>;
