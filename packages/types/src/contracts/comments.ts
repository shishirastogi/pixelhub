import { z } from "zod";

export const createCommentSchema = z
  .object({
    versionId: z.string().uuid().optional(),
    fileId: z.string().uuid().optional(),
    parentCommentId: z.string().uuid().optional(),
    body: z.string().min(1).max(10_000),
    anchor: z.unknown().optional(),
  })
  .refine((value) => Boolean(value.versionId ?? value.fileId), {
    message: "Either versionId or fileId is required",
    path: ["versionId"],
  });
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
