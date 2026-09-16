import { z } from "zod";
import {
  BrandColorRole,
  BrandFontRole,
  BrandLogoVariant,
  BrandRuleType,
  CheckStatus,
  Severity,
} from "../enums";

export const brandColorSchema = z.object({
  name: z.string().min(1).max(120),
  hex: z.string().regex(/^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  role: z.nativeEnum(BrandColorRole),
  tolerance: z.number().int().min(0).max(100).optional(),
});
export type BrandColorInput = z.infer<typeof brandColorSchema>;

export const brandFontSchema = z.object({
  family: z.string().min(1).max(200),
  role: z.nativeEnum(BrandFontRole),
  fallbacks: z.array(z.string().min(1).max(200)).optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
});
export type BrandFontInput = z.infer<typeof brandFontSchema>;

export const brandLogoSchema = z.object({
  name: z.string().min(1).max(200),
  variant: z.nativeEnum(BrandLogoVariant),
  fileId: z.string().uuid(),
  isCurrent: z.boolean().optional(),
});
export type BrandLogoInput = z.infer<typeof brandLogoSchema>;

export const brandRuleSchema = z.object({
  ruleType: z.nativeEnum(BrandRuleType),
  payload: z.unknown(),
  severity: z.nativeEnum(Severity).optional(),
});
export type BrandRuleInput = z.infer<typeof brandRuleSchema>;

export const saveBrandKitSchema = z.object({
  name: z.string().min(1).max(200),
  guidelinesText: z.string().max(50_000).nullable().optional(),
  styleGuideFileId: z.string().uuid().nullable().optional(),
  colors: z.array(brandColorSchema).max(200).optional(),
  fonts: z.array(brandFontSchema).max(200).optional(),
  logos: z.array(brandLogoSchema).max(200).optional(),
  rules: z.array(brandRuleSchema).max(200).optional(),
});
export type SaveBrandKitInput = z.infer<typeof saveBrandKitSchema>;

export const runBrandCheckSchema = z.object({
  fileIds: z.array(z.string().uuid()).max(500).optional(),
});
export type RunBrandCheckInput = z.infer<typeof runBrandCheckSchema>;

export const listBrandChecksQuerySchema = z.object({
  status: z.nativeEnum(CheckStatus).optional(),
  severity: z.nativeEnum(Severity).optional(),
  resolved: z.enum(["true", "false"]).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListBrandChecksQuery = z.infer<typeof listBrandChecksQuerySchema>;

export const resolveBrandCheckSchema = z.object({
  note: z.string().max(2000).optional(),
});
export type ResolveBrandCheckInput = z.infer<typeof resolveBrandCheckSchema>;
