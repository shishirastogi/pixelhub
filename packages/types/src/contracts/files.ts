import { z } from "zod";
import { FileKind } from "../enums";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "Invalid sha256");

export const fileEventTypeSchema = z.enum([
  "created",
  "modified",
  "deleted",
  "moved",
]);
export type FileEventType = z.infer<typeof fileEventTypeSchema>;

export const fileEventSchema = z.object({
  type: fileEventTypeSchema,
  path: z.string().min(1).max(2000).optional(),
  sha256: sha256Schema.optional(),
  size: z.number().int().nonnegative().optional(),
  from: z.string().min(1).max(2000).optional(),
  to: z.string().min(1).max(2000).optional(),
});
export type FileEventInput = z.infer<typeof fileEventSchema>;

export const ingestFilesSchema = z.object({
  events: z.array(fileEventSchema).max(5000),
  mode: z.enum(["full", "delta"]),
});
export type IngestFilesInput = z.infer<typeof ingestFilesSchema>;

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1).max(500),
  contentType: z.string().min(1).max(255),
  size: z.number().int().nonnegative().optional(),
  sha256: sha256Schema.optional(),
});
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;

export const confirmFileSchema = z.object({
  path: z.string().min(1).max(2000),
  fileName: z.string().min(1).max(500),
  extension: z.string().max(32),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  sha256: sha256Schema,
  storageKey: z.string().min(1).max(1000).optional(),
  kind: z.nativeEnum(FileKind).optional(),
  branchId: z.string().uuid().optional(),
});
export type ConfirmFileInput = z.infer<typeof confirmFileSchema>;

export const listFilesQuerySchema = z.object({
  kind: z.nativeEnum(FileKind).optional(),
  branchId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
