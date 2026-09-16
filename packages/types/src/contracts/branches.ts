import { z } from "zod";
import { BranchKind, BranchStatus } from "../enums";

export const createBranchSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.nativeEnum(BranchKind),
  fromBranchId: z.string().uuid().optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(80).optional(),
  status: z.nativeEnum(BranchStatus).optional(),
});
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const mergeBranchSchema = z.object({
  targetBranchId: z.string().uuid().optional(),
  fileIds: z.array(z.string().uuid()).min(1).optional(),
});
export type MergeBranchInput = z.infer<typeof mergeBranchSchema>;
