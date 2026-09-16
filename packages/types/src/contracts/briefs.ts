import { z } from "zod";

export const updateBriefSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  rawText: z.string().min(1).max(100_000),
  sourceFileId: z.string().uuid().nullable().optional(),
});
export type UpdateBriefInput = z.infer<typeof updateBriefSchema>;
