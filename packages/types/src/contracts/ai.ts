import { z } from "zod";
import { BrandCheckType, CheckStatus, Priority, Severity } from "../enums";

/**
 * AI job contracts (docs/07-ai-workflows.md). Two families:
 *  - `*InputSchema` — the reference-only payload stored on `AiJob.inputJson`.
 *  - `*ResultSchema` — the zod-validated model output persisted to `AiJob.resultJson`.
 */

// ─────────────────────────────────────────────────────────────
// Job inputs (references, never raw blobs)
// ─────────────────────────────────────────────────────────────

export const extractRequirementsInputSchema = z.object({
  briefId: z.string().uuid(),
});
export type ExtractRequirementsInput = z.infer<typeof extractRequirementsInputSchema>;

export const generateTasksInputSchema = z.object({
  requirementId: z.string().uuid(),
});
export type GenerateTasksInput = z.infer<typeof generateTasksInputSchema>;

export const compareVersionsJobInputSchema = z.object({
  comparisonId: z.string().uuid(),
  baseVersionId: z.string().uuid(),
  targetVersionId: z.string().uuid(),
});
export type CompareVersionsJobInput = z.infer<typeof compareVersionsJobInputSchema>;

export const brandCheckInputSchema = z.object({
  fileId: z.string().uuid().optional(),
  fileIds: z.array(z.string().uuid()).optional(),
});
export type BrandCheckInput = z.infer<typeof brandCheckInputSchema>;

export const matchFileInputSchema = z.object({
  fileId: z.string().uuid(),
});
export type MatchFileInput = z.infer<typeof matchFileInputSchema>;

export const projectStatusNarrativeInputSchema = z.object({}).passthrough();
export type ProjectStatusNarrativeInput = z.infer<
  typeof projectStatusNarrativeInputSchema
>;

// ─────────────────────────────────────────────────────────────
// A. EXTRACT_REQUIREMENTS
// ─────────────────────────────────────────────────────────────

export const deliverableSuggestionSchema = z.object({
  name: z.string().min(1),
  filePattern: z.string().min(1),
});
export type DeliverableSuggestion = z.infer<typeof deliverableSuggestionSchema>;

export const requirementSuggestionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  priority: z.nativeEnum(Priority),
  deliverables: z.array(deliverableSuggestionSchema).optional(),
  suggestedDueDate: z.string().optional(),
});
export type RequirementSuggestion = z.infer<typeof requirementSuggestionSchema>;

export const extractRequirementsResultSchema = z.object({
  requirements: z.array(requirementSuggestionSchema),
  summary: z.string(),
  uncertainties: z.array(z.string()).optional(),
});
export type ExtractRequirementsResult = z.infer<
  typeof extractRequirementsResultSchema
>;

// ─────────────────────────────────────────────────────────────
// B. GENERATE_TASKS
// ─────────────────────────────────────────────────────────────

export const generatedTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueOffsetDays: z.number().int().min(0).optional(),
});
export type GeneratedTask = z.infer<typeof generatedTaskSchema>;

export const generateTasksResultSchema = z.object({
  tasks: z.array(generatedTaskSchema),
});
export type GenerateTasksResult = z.infer<typeof generateTasksResultSchema>;

// ─────────────────────────────────────────────────────────────
// C. COMPARE_VERSIONS
// ─────────────────────────────────────────────────────────────

export const versionChangeSchema = z.object({
  dimension: z.enum(["color", "typography", "layout", "copy"]),
  finding: z.string(),
  impact: z.enum(["low", "medium", "high"]),
});
export type VersionChange = z.infer<typeof versionChangeSchema>;

export const compareVersionsResultSchema = z.object({
  summary: z.string(),
  changes: z.array(versionChangeSchema).optional(),
  designerEnglish: z.string(),
});
export type CompareVersionsResult = z.infer<typeof compareVersionsResultSchema>;

// ─────────────────────────────────────────────────────────────
// D. BRAND_CHECK
// ─────────────────────────────────────────────────────────────

export const brandFindingSchema = z.object({
  checkType: z.nativeEnum(BrandCheckType),
  rule: z.string(),
  expected: z.string(),
  found: z.string(),
  message: z.string(),
  severity: z.nativeEnum(Severity),
  deltaE: z.number().optional(),
  /** Target file id (or project-relative path) this finding belongs to. */
  fileId: z.string().optional(),
});
export type BrandFinding = z.infer<typeof brandFindingSchema>;

export const brandCheckResultSchema = z.object({
  findings: z.array(brandFindingSchema).optional(),
  verdict: z.nativeEnum(CheckStatus),
});
export type BrandCheckResult = z.infer<typeof brandCheckResultSchema>;

// ─────────────────────────────────────────────────────────────
// E. MATCH_FILE
// ─────────────────────────────────────────────────────────────

export const fileMatchSchema = z.object({
  deliverableId: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});
export type FileMatch = z.infer<typeof fileMatchSchema>;

export const matchFileResultSchema = z.object({
  matches: z.array(fileMatchSchema).optional(),
});
export type MatchFileResult = z.infer<typeof matchFileResultSchema>;

// ─────────────────────────────────────────────────────────────
// F. PROJECT_STATUS_NARRATIVE
// ─────────────────────────────────────────────────────────────

export const statusAttentionItemSchema = z.object({
  title: z.string(),
  message: z.string(),
  severity: z.nativeEnum(Severity),
});
export type StatusAttentionItem = z.infer<typeof statusAttentionItemSchema>;

export const projectStatusNarrativeResultSchema = z.object({
  narrative: z.string(),
  attentionItems: z.array(statusAttentionItemSchema).optional(),
  suggestedNextActions: z.array(z.string()).optional(),
});
export type ProjectStatusNarrativeResult = z.infer<
  typeof projectStatusNarrativeResultSchema
>;
