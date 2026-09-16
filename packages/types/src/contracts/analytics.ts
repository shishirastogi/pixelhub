import { z } from "zod";

export const branchVersionCountSchema = z.object({
  branchId: z.string(),
  name: z.string(),
  versions: z.number().int().nonnegative(),
});

export const versionMetricsSchema = z.object({
  branchCount: z.number().int().nonnegative(),
  totalVersions: z.number().int().nonnegative(),
  avgIntervalDays: z.number().nullable(),
  mergesLast7d: z.number().int().nonnegative(),
  perBranch: z.array(branchVersionCountSchema),
});
export type VersionMetrics = z.infer<typeof versionMetricsSchema>;

export const requirementMetricsSchema = z.object({
  fulfilled: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  coveragePct: z.number().min(0).max(100),
  avgRevisions: z.number().nonnegative(),
  overdue: z.number().int().nonnegative(),
});
export type RequirementMetrics = z.infer<typeof requirementMetricsSchema>;

export const requirementTrendPointSchema = z.object({
  date: z.string(),
  coveragePct: z.number().min(0).max(100),
});
export type RequirementTrendPoint = z.infer<typeof requirementTrendPointSchema>;

export const requirementAnalyticsSchema = requirementMetricsSchema.extend({
  trend: z.array(requirementTrendPointSchema),
});
export type RequirementAnalytics = z.infer<typeof requirementAnalyticsSchema>;

export const storageByKindSchema = z.object({
  kind: z.string(),
  bytes: z.number().nonnegative(),
});

export const fileMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  produced: z.number().int().nonnegative(),
  required: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  typeDistribution: z.record(z.number().int().nonnegative()),
  outdatedCount: z.number().int().nonnegative(),
  storageByKind: z.array(storageByKindSchema),
});
export type FileMetrics = z.infer<typeof fileMetricsSchema>;

export const collaborationMetricsSchema = z.object({
  activeContributors: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  avgReviewTurnaroundH: z.number().nonnegative().nullable(),
  approvalIterations: z.number().nonnegative().nullable(),
});
export type CollaborationMetrics = z.infer<typeof collaborationMetricsSchema>;

export const designMetricsSchema = z.object({
  colorChangeCount: z.number().int().nonnegative(),
  fontChangeCount: z.number().int().nonnegative(),
  layoutChangeCount: z.number().int().nonnegative(),
});
export type DesignMetrics = z.infer<typeof designMetricsSchema>;

export const aiMetricsSchema = z.object({
  jobsRun: z.number().int().nonnegative(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  estCostUsd: z.number().nonnegative(),
});
export type AiMetrics = z.infer<typeof aiMetricsSchema>;

export const analyticsMetricsSchema = z.object({
  versions: versionMetricsSchema,
  requirements: requirementMetricsSchema,
  files: fileMetricsSchema,
  collaboration: collaborationMetricsSchema,
  design: designMetricsSchema,
  ai: aiMetricsSchema,
});
export type AnalyticsMetrics = z.infer<typeof analyticsMetricsSchema>;

export const versionAnalyticsSchema = versionMetricsSchema;
export type VersionAnalytics = VersionMetrics;

export const fileAnalyticsSchema = fileMetricsSchema;
export type FileAnalytics = FileMetrics;

export const collaborationAnalyticsSchema = collaborationMetricsSchema;
export type CollaborationAnalytics = CollaborationMetrics;

export const analyticsSnapshotSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  date: z.union([z.string(), z.date()]),
  metrics: analyticsMetricsSchema,
  computedAt: z.union([z.string(), z.date()]),
});
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
