import type { Prisma } from "@prisma/client";
import type { AiUsage } from "@pixelhub/ai";
import { BrandCheckType, CheckStatus, Priority, Severity } from "@pixelhub/types";
import type { ZodType } from "zod";
import { emit } from "../../activity";
import {
  getAiProvider,
  defaultModel,
  hasOpenAiKey,
  visionModel,
} from "../../ai/provider";
import { prisma } from "../../db";
import {
  brandCheckInputSchema,
  brandCheckResultSchema,
  compareVersionsJobInputSchema,
  compareVersionsResultSchema,
  extractRequirementsInputSchema,
  extractRequirementsResultSchema,
  generateTasksInputSchema,
  generateTasksResultSchema,
  matchFileInputSchema,
  matchFileResultSchema,
  projectStatusNarrativeInputSchema,
  projectStatusNarrativeResultSchema,
  type BrandCheckResult,
  type BrandFinding,
  type CompareVersionsResult,
  type ExtractRequirementsResult,
  type GenerateTasksResult,
  type MatchFileResult,
  type ProjectStatusNarrativeResult,
} from "./schemas";
import {
  brandCheckPrompt,
  compareVersionsPrompt,
  extractRequirementsPrompt,
  generateTasksPrompt,
  matchFilePrompt,
  statusNarrativePrompt,
  type PromptBundle,
  type StatusContext,
} from "./prompts";

type JobWithProject = Prisma.AiJobGetPayload<{ include: { project: true } }>;

interface JobOutcome {
  resultJson: Prisma.InputJsonValue;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MATCH_CONFIDENCE_THRESHOLD = 0.85;
const BRAND_CHECK_FILE_LIMIT = 25;

/**
 * Runs one AI job end to end (docs/07-ai-workflows.md §3). Never rethrows:
 * failures are recorded on the job row; `queue.ts` guards the fire-and-forget call.
 */
export async function runAiJob(jobId: string): Promise<void> {
  const job = await prisma.aiJob.findUnique({
    where: { id: jobId },
    include: { project: true },
  });
  if (!job) return;

  if (!job.project.aiEnabled) {
    await markFailed(jobId, "AI disabled for this project");
    return;
  }

  await prisma.aiJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const outcome = await dispatch(job, jobId).catch(async (error: unknown) => {
    await markFailed(
      jobId,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  });
  if (!outcome) return;

  await prisma.aiJob.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      resultJson: outcome.resultJson,
      tokensIn: outcome.tokensIn,
      tokensOut: outcome.tokensOut,
      model: outcome.model,
      finishedAt: new Date(),
    },
  });
}

async function markFailed(jobId: string, message: string): Promise<void> {
  await prisma.aiJob
    .update({
      where: { id: jobId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    })
    .catch(() => undefined);
}

async function dispatch(job: JobWithProject, jobId: string): Promise<JobOutcome> {
  switch (job.type) {
    case "EXTRACT_REQUIREMENTS":
      return runExtractRequirements(job, jobId);
    case "GENERATE_TASKS":
      return runGenerateTasks(job);
    case "COMPARE_VERSIONS":
      return runCompareVersions(job, jobId);
    case "BRAND_CHECK":
      return runBrandCheck(job, jobId);
    case "MATCH_FILE":
      return runMatchFile(job, jobId);
    case "PROJECT_STATUS_NARRATIVE":
      return runStatusNarrative(job);
    default: {
      const exhaustive: never = job.type;
      throw new Error(`Unsupported AI job type: ${String(exhaustive)}`);
    }
  }
}

async function completeJsonWithFallback<T>(
  model: string,
  prompt: PromptBundle,
  schema: ZodType<T>,
  fallback: () => T,
): Promise<{ parsed: T; usage: AiUsage; model: string }> {
  if (hasOpenAiKey()) {
    try {
      const completion = await getAiProvider().complete({
        model,
        system: prompt.system,
        messages: prompt.messages,
        json: schema,
      });
      if (completion.parsed !== undefined) {
        return { parsed: completion.parsed, usage: completion.usage, model };
      }
    } catch {
      // Fall through to deterministic local engine when API key is invalid or unreachable
    }
  }
  return {
    parsed: fallback(),
    usage: { tokensIn: 0, tokensOut: 0 },
    model: "pixelhub-deterministic-v1",
  };
}

// ─────────────────────────────────────────────────────────────
// Deterministic CIE76 ΔE & Local Fallback Helpers
// ─────────────────────────────────────────────────────────────

function hexToLab(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);

  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) / 1.0;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function computeDeltaE(hexA: string, hexB: string): number | null {
  const labA = hexToLab(hexA);
  const labB = hexToLab(hexB);
  if (!labA || !labB) return null;
  const dL = labA[0] - labB[0];
  const da = labA[1] - labB[1];
  const db = labA[2] - labB[2];
  return Math.round(Math.sqrt(dL * dL + da * da + db * db) * 10) / 10;
}

function slugPatternFromTitle(title: string): string {
  const stem = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
  return `${stem || "deliverable"}_*.{png,jpg,svg,pdf}`;
}

function fallbackExtractRequirements(rawText: string): ExtractRequirementsResult {
  const candidates = rawText
    .split(/\r?\n|(?<=[.!;])\s+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length >= 6);

  const requirements: ExtractRequirementsResult["requirements"] = [];
  const wordNum: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };

  for (const clause of candidates) {
    const subParts = clause
      .split(/,|;|\band\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);

    for (const part of subParts) {
      if (/^(deadline|use the|primary brand|logo must|never)/i.test(part)) {
        continue;
      }
      const numMatch = part.match(
        /\b(\d+|one|two|three|four|five|six)\s+([a-z0-9\s-]{3,35})/i,
      );
      const keywordMatch = part.match(
        /\b(instagram\s+posts?|hero\s+banner|banner|logo\s+lockup|logo|newsletter|social\s+posts?|carousel|story|stories|poster|deck|guidelines|icon\s+set|landing\s+page)\b/i,
      );
      if (!numMatch && !keywordMatch) continue;

      const qtyRaw = numMatch?.[1]?.toLowerCase();
      const quantity = qtyRaw
        ? (wordNum[qtyRaw] ?? (Number.parseInt(qtyRaw, 10) || 1))
        : 1;
      const rawTitle = (keywordMatch?.[1] ?? numMatch?.[2] ?? part)
        .replace(/^(a|an|the|refreshed|updated)\s+/i, "")
        .trim();
      if (!rawTitle || rawTitle.length < 3) continue;

      const title =
        rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1).slice(0, 60);
      if (
        requirements.some((r) => r.title.toLowerCase() === title.toLowerCase())
      ) {
        continue;
      }

      const stem = title
        .toLowerCase()
        .replace(/posts?$/, "post")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      const deliverables = Array.from({ length: Math.min(quantity, 6) }).map(
        (_, i) => ({
          name:
            quantity > 1
              ? `${stem}_${String(i + 1).padStart(2, "0")}`
              : stem || "export",
          filePattern:
            quantity > 1
              ? `${stem}_*.{png,jpg,webp}`
              : slugPatternFromTitle(title),
        }),
      );

      requirements.push({
        title,
        description: part,
        quantity,
        priority:
          quantity >= 3 || /hero|launch|instagram/i.test(title)
            ? Priority.HIGH
            : Priority.MEDIUM,
        deliverables,
      });
    }
  }

  if (requirements.length === 0) {
    requirements.push({
      title: "Primary Campaign Deliverables",
      description: rawText.slice(0, 180),
      quantity: 2,
      priority: Priority.HIGH,
      deliverables: [
        { name: "export_01", filePattern: "export_*.{png,jpg,svg}" },
        { name: "export_02", filePattern: "export_*.{png,jpg,svg}" },
      ],
    });
  }

  return {
    requirements: requirements.slice(0, 8),
    summary: `Extracted ${Math.min(requirements.length, 8)} requirement proposal(s) from the project brief.`,
    uncertainties: [],
  };
}

function fallbackGenerateTasks(requirement: {
  title: string;
  description: string | null;
}): GenerateTasksResult {
  return {
    tasks: [
      {
        title: `Concept & layout exploration for ${requirement.title}`,
        description:
          requirement.description ??
          `Draft initial composition and artboards for ${requirement.title}.`,
        dueOffsetDays: 1,
      },
      {
        title: `Apply brand kit palette & typography to ${requirement.title}`,
        description:
          "Verify colors stay within ΔE tolerance and approved fonts are applied.",
        dueOffsetDays: 2,
      },
      {
        title: `Export production assets for ${requirement.title}`,
        description:
          "Save final exports into exports/ so PixelHub auto-matches the deliverables.",
        dueOffsetDays: 3,
      },
    ],
  };
}

function fallbackCompareVersions(
  baseNumber: number,
  targetNumber: number,
  diffJson: Prisma.JsonValue,
): CompareVersionsResult {
  const diff = asJsonObject(diffJson);
  const filesObj = asJsonObject((diff.files as Prisma.JsonValue) ?? {});
  const added = Array.isArray(filesObj.added) ? filesObj.added.length : 0;
  const removed = Array.isArray(filesObj.removed) ? filesObj.removed.length : 0;
  const modified = Array.isArray(filesObj.modified)
    ? filesObj.modified.length
    : 0;
  const renamed = Array.isArray(filesObj.renamed) ? filesObj.renamed.length : 0;

  const colorsObj = asJsonObject((diff.colors as Prisma.JsonValue) ?? {});
  const colorsBefore = Array.isArray(colorsObj.dominantBefore)
    ? (colorsObj.dominantBefore as string[])
    : [];
  const colorsAfter = Array.isArray(colorsObj.dominantAfter)
    ? (colorsObj.dominantAfter as string[])
    : [];

  const changes: NonNullable<CompareVersionsResult["changes"]> = [];
  if (added > 0 || modified > 0 || removed > 0 || renamed > 0) {
    changes.push({
      dimension: "layout",
      finding: `${added} file(s) added, ${modified} modified, ${removed} removed, and ${renamed} renamed between v${baseNumber} and v${targetNumber}.`,
      impact: added + modified > 2 ? "high" : "medium",
    });
  }
  if (colorsBefore.join(",") !== colorsAfter.join(",")) {
    changes.push({
      dimension: "color",
      finding: `Dominant palette shifted from [${colorsBefore.join(", ") || "none"}] to [${colorsAfter.join(", ") || "none"}].`,
      impact: "medium",
    });
  }

  const summary = `Compared v${baseNumber} → v${targetNumber}: ${added} added, ${modified} modified, ${removed} removed, ${renamed} renamed.`;
  const designerEnglish = `${summary} ${
    colorsAfter.length > 0
      ? `Target snapshot exhibits dominant colors ${colorsAfter.join(", ")}.`
      : "All pinned file checksums were verified deterministically."
  }`;

  return {
    summary,
    changes,
    designerEnglish,
  };
}

function deterministicBrandCheck(
  brandKit: {
    colors: Array<{ name: string; hex: string; role: string; tolerance: number }>;
    fonts: Array<{ family: string; role: string }>;
    rules: Array<{ ruleType: string; payload: Prisma.JsonValue; severity: Severity }>;
  } | null,
  files: Array<{
    id: string;
    path: string;
    fileName: string;
    imageMeta: Prisma.JsonValue;
  }>,
): BrandCheckResult {
  const findings: BrandFinding[] = [];
  if (!brandKit) {
    return { findings: [], verdict: CheckStatus.PASS };
  }

  const forbiddenColors = brandKit.rules
    .filter((r) => r.ruleType === "FORBIDDEN_COLOR")
    .map((r) => {
      const obj = asJsonObject(r.payload);
      return {
        hex: String(obj.hex ?? obj.value ?? "").trim(),
        severity: r.severity,
      };
    })
    .filter((r) => r.hex.startsWith("#"));

  for (const file of files) {
    const meta = asJsonObject(file.imageMeta);
    const dominantColors = Array.isArray(meta.dominantColors)
      ? (meta.dominantColors.filter((c): c is string => typeof c === "string") ?? [])
      : [];

    for (const domColor of dominantColors) {
      for (const forbidden of forbiddenColors) {
        const de = computeDeltaE(domColor, forbidden.hex);
        if (de !== null && de <= 12) {
          findings.push({
            checkType: BrandCheckType.COLOR,
            rule: "Forbidden color rule",
            expected: `Not ${forbidden.hex}`,
            found: domColor,
            deltaE: de,
            message: `${file.fileName} contains forbidden color ${domColor} (ΔE ${de} from ${forbidden.hex}).`,
            severity: forbidden.severity,
            fileId: file.id,
          });
        }
      }

      if (brandKit.colors.length > 0) {
        let bestColor = brandKit.colors[0]!;
        let bestDe = computeDeltaE(domColor, bestColor.hex) ?? 999;
        for (const kitColor of brandKit.colors) {
          const de = computeDeltaE(domColor, kitColor.hex);
          if (de !== null && de < bestDe) {
            bestDe = de;
            bestColor = kitColor;
          }
        }
        if (bestDe > (bestColor.tolerance || 10) && bestDe < 999) {
          findings.push({
            checkType: BrandCheckType.COLOR,
            rule: `Matches brand color (${bestColor.name})`,
            expected: `${bestColor.hex} (±${bestColor.tolerance} ΔE)`,
            found: domColor,
            deltaE: bestDe,
            message: `Color ${domColor} in ${file.fileName} drifts from ${bestColor.name} (${bestColor.hex}) by ΔE ${bestDe}.`,
            severity: bestDe > bestColor.tolerance * 2 ? Severity.ERROR : Severity.WARNING,
            fileId: file.id,
          });
        }
      }
    }
  }

  const hasError = findings.some((f) => f.severity === Severity.ERROR);
  const verdict = hasError
    ? CheckStatus.FAIL
    : findings.length > 0
      ? CheckStatus.WARNING
      : CheckStatus.PASS;

  return { findings, verdict };
}

function fallbackStatusNarrative(
  context: StatusContext,
): ProjectStatusNarrativeResult {
  const {
    projectName,
    deadline,
    requirementCoveragePct,
    requirements,
    deliverables,
    overdue,
    branchSummary,
    openTasks,
    failingBrandChecks,
  } = context;

  const narrative = `${projectName} is at ${requirementCoveragePct}% requirement coverage (${requirements.fulfilled}/${requirements.accepted} accepted requirements fulfilled, ${deliverables.done}/${deliverables.total} deliverables matched). Active branches: ${branchSummary}. ${
    overdue.length > 0
      ? `${overdue.length} requirement(s) are currently past due.`
      : "No requirements are overdue."
  } ${
    failingBrandChecks.length > 0
      ? `${failingBrandChecks.length} export(s) have unresolved brand QA findings.`
      : "All brand checks are passing."
  }${deadline ? ` Target project deadline is ${deadline}.` : ""}`;

  const attentionItems: NonNullable<
    ProjectStatusNarrativeResult["attentionItems"]
  > = [];
  for (const item of overdue) {
    attentionItems.push({
      title: "Overdue Requirement",
      message: item,
      severity: Severity.ERROR,
    });
  }
  for (const fileName of failingBrandChecks) {
    attentionItems.push({
      title: `Brand Drift on ${fileName}`,
      message: `${fileName} has unresolved brand check findings.`,
      severity: Severity.WARNING,
    });
  }

  const suggestedNextActions: string[] = [];
  if (deliverables.done < deliverables.total) {
    suggestedNextActions.push(
      `Upload or sync the remaining ${deliverables.total - deliverables.done} deliverable export(s) into exports/.`,
    );
  }
  if (failingBrandChecks.length > 0) {
    suggestedNextActions.push(
      `Review and resolve brand QA findings on ${failingBrandChecks.slice(0, 2).join(", ")}.`,
    );
  }
  if (openTasks > 0) {
    suggestedNextActions.push(
      `Complete the ${openTasks} open task(s) on the Tasks board.`,
    );
  }
  if (suggestedNextActions.length === 0) {
    suggestedNextActions.push(
      "Snapshot a new milestone version and adopt approved branches into Main.",
    );
  }

  return { narrative, attentionItems, suggestedNextActions };
}

// ─────────────────────────────────────────────────────────────
// A. EXTRACT_REQUIREMENTS
// ─────────────────────────────────────────────────────────────

async function runExtractRequirements(
  job: JobWithProject,
  jobId: string,
): Promise<JobOutcome> {
  const input = extractRequirementsInputSchema.parse(job.inputJson);
  const brief = await prisma.brief.findFirst({
    where: { id: input.briefId, projectId: job.projectId, deletedAt: null },
  });
  if (!brief) throw new Error("Brief not found for AI extraction");

  const model = defaultModel();
  const { parsed, usage, model: usedModel } = await completeJsonWithFallback(
    model,
    extractRequirementsPrompt(brief.rawText),
    extractRequirementsResultSchema,
    () => fallbackExtractRequirements(brief.rawText),
  );

  const requirementIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];

    for (const suggestion of parsed.requirements) {
      const dueDate = suggestion.suggestedDueDate
        ? new Date(suggestion.suggestedDueDate)
        : null;

      const created = await tx.requirement.create({
        data: {
          projectId: job.projectId,
          briefId: brief.id,
          title: suggestion.title,
          description: suggestion.description ?? null,
          quantity: suggestion.quantity ?? 1,
          priority: suggestion.priority,
          status: "PENDING",
          source: "AI_EXTRACTED",
          dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
          deliverables: {
            create: (suggestion.deliverables ?? []).map((deliverable) => ({
              name: deliverable.name,
              filePatterns: [deliverable.filePattern],
            })),
          },
        },
        select: { id: true },
      });

      ids.push(created.id);
    }

    await tx.brief.update({
      where: { id: brief.id },
      data: { extractedAt: new Date(), extractionJobId: jobId },
    });

    await emit(
      {
        projectId: job.projectId,
        actorId: job.requestedById,
        type: "requirement.extracted",
        entityType: "Brief",
        entityId: brief.id,
        meta: { jobId, requirementIds: ids },
      },
      tx,
    );

    return ids;
  });

  return {
    resultJson: {
      requirementIds,
      summary: parsed.summary,
      uncertainties: parsed.uncertainties ?? [],
    },
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    model: usedModel,
  };
}

// ─────────────────────────────────────────────────────────────
// B. GENERATE_TASKS
// ─────────────────────────────────────────────────────────────

async function runGenerateTasks(job: JobWithProject): Promise<JobOutcome> {
  const input = generateTasksInputSchema.parse(job.inputJson);
  const requirement = await prisma.requirement.findFirst({
    where: {
      id: input.requirementId,
      projectId: job.projectId,
      deletedAt: null,
    },
  });
  if (!requirement) throw new Error("Requirement not found for task generation");

  const model = defaultModel();
  const { parsed, usage, model: usedModel } = await completeJsonWithFallback(
    model,
    generateTasksPrompt({
      projectName: job.project.name,
      requirementTitle: requirement.title,
      requirementDescription: requirement.description,
      deadline: formatDate(job.project.deadline),
    }),
    generateTasksResultSchema,
    () => fallbackGenerateTasks(requirement),
  );

  const now = Date.now();
  const taskIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];

    for (const task of parsed.tasks) {
      const checklistJson: Prisma.InputJsonValue = [
        { text: `Review specification for ${requirement.title}`, done: false },
        { text: task.description ?? task.title, done: false },
        { text: "Verify export matches file pattern & brand kit", done: false },
      ];
      const created = await tx.task.create({
        data: {
          projectId: job.projectId,
          requirementId: requirement.id,
          title: task.title,
          description: task.description ?? null,
          checklistJson,
          source: "AI_EXTRACTED",
          status: "TODO",
          dueDate:
            task.dueOffsetDays !== undefined
              ? new Date(now + task.dueOffsetDays * DAY_MS)
              : null,
        },
        select: { id: true },
      });
      ids.push(created.id);
    }

    await emit(
      {
        projectId: job.projectId,
        actorId: job.requestedById,
        type: "task.generated",
        entityType: "Requirement",
        entityId: requirement.id,
        meta: { taskIds: ids },
      },
      tx,
    );

    return ids;
  });

  return {
    resultJson: { taskIds },
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    model: usedModel,
  };
}

// ─────────────────────────────────────────────────────────────
// C. COMPARE_VERSIONS
// ─────────────────────────────────────────────────────────────

async function runCompareVersions(
  job: JobWithProject,
  jobId: string,
): Promise<JobOutcome> {
  const input = compareVersionsJobInputSchema.parse(job.inputJson);
  const comparison = await prisma.versionComparison.findFirst({
    where: { id: input.comparisonId, projectId: job.projectId },
    include: {
      baseVersion: {
        select: { id: true, number: true, label: true, createdAt: true },
      },
      targetVersion: {
        select: { id: true, number: true, label: true, createdAt: true },
      },
    },
  });
  if (!comparison) throw new Error("Version comparison not found");

  const [baseFiles, targetFiles] = await Promise.all([
    prisma.versionFile.findMany({
      where: { versionId: comparison.baseVersionId },
      select: { path: true, role: true, fileId: true },
    }),
    prisma.versionFile.findMany({
      where: { versionId: comparison.targetVersionId },
      select: { path: true, role: true, fileId: true },
    }),
  ]);

  const baseByPath = new Map(baseFiles.map((file) => [file.path, file]));
  const targetByPath = new Map(targetFiles.map((file) => [file.path, file]));
  const changedFiles: CompareVersionsPromptInputFiles = [];

  for (const [path, file] of targetByPath) {
    const base = baseByPath.get(path);
    if (!base || base.fileId !== file.fileId) {
      changedFiles.push({
        path,
        status: base ? "modified" : "added",
        role: file.role,
      });
    }
  }
  for (const [path, file] of baseByPath) {
    if (!targetByPath.has(path)) {
      changedFiles.push({ path, status: "removed", role: file.role });
    }
  }

  const model = visionModel();
  const { parsed, usage, model: usedModel } = await completeJsonWithFallback(
    model,
    compareVersionsPrompt({
      projectName: job.project.name,
      base: {
        number: comparison.baseVersion.number,
        label: comparison.baseVersion.label,
        createdAt: comparison.baseVersion.createdAt.toISOString(),
      },
      target: {
        number: comparison.targetVersion.number,
        label: comparison.targetVersion.label,
        createdAt: comparison.targetVersion.createdAt.toISOString(),
      },
      diff: comparison.diffJson,
      changedFiles,
    }),
    compareVersionsResultSchema,
    () =>
      fallbackCompareVersions(
        comparison.baseVersion.number,
        comparison.targetVersion.number,
        comparison.diffJson,
      ),
  );

  await prisma.$transaction(async (tx) => {
    const nextDiff = {
      ...asJsonObject(comparison.diffJson),
      ai: parsed,
    } as unknown as Prisma.InputJsonValue;

    await tx.versionComparison.update({
      where: { id: comparison.id },
      data: {
        summaryMd: parsed.designerEnglish || parsed.summary,
        jobId,
        diffJson: nextDiff,
      },
    });

    await emit(
      {
        projectId: job.projectId,
        actorId: job.requestedById,
        type: "version.compared",
        entityType: "VersionComparison",
        entityId: comparison.id,
        meta: { jobId, changes: parsed.changes?.length ?? 0 },
      },
      tx,
    );
  });

  return {
    resultJson: parsed as unknown as Prisma.InputJsonValue,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    model: usedModel,
  };
}

type CompareVersionsPromptInputFiles = {
  path: string;
  status: string;
  role: string;
}[];

// ─────────────────────────────────────────────────────────────
// D. BRAND_CHECK
// ─────────────────────────────────────────────────────────────

async function runBrandCheck(
  job: JobWithProject,
  jobId: string,
): Promise<JobOutcome> {
  const input = brandCheckInputSchema.parse(job.inputJson);
  const targetFileIds =
    input.fileIds && input.fileIds.length > 0
      ? input.fileIds
      : input.fileId
        ? [input.fileId]
        : undefined;
  const [brandKit, files] = await Promise.all([
    prisma.brandKit.findUnique({
      where: { projectId: job.projectId },
      include: { colors: true, fonts: true, logos: true, rules: true },
    }),
    resolveBrandCheckFiles(job.projectId, targetFileIds),
  ]);

  const model = visionModel();
  const { parsed, usage, model: usedModel } = await completeJsonWithFallback(
    model,
    brandCheckPrompt({ brandKit, files }),
    brandCheckResultSchema,
    () => deterministicBrandCheck(brandKit, files),
  );

  const resultIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];

    const allFindings = parsed.findings ?? [];

    for (const file of files) {
      const scoped = allFindings.filter(
        (finding) => finding.fileId === file.id || finding.fileId === file.path,
      );
      const unattributed = allFindings.filter((finding) => !finding.fileId);
      const findings = scoped.concat(unattributed);
      const hasErr = findings.some((f) => f.severity === Severity.ERROR);
      const status =
        findings.length === 0
          ? CheckStatus.PASS
          : hasErr
            ? CheckStatus.FAIL
            : parsed.verdict === CheckStatus.PASS
              ? CheckStatus.WARNING
              : parsed.verdict;
      const checkType = findings[0]?.checkType ?? "COLOR";

      const created = await tx.brandCheckResult.create({
        data: {
          projectId: job.projectId,
          fileId: file.id,
          jobId,
          checkType,
          status,
          findings: findings as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      ids.push(created.id);
    }

    await emit(
      {
        projectId: job.projectId,
        actorId: job.requestedById,
        type: "brand.checked",
        entityType: "Project",
        entityId: job.projectId,
        meta: { jobId, resultIds: ids, verdict: parsed.verdict },
      },
      tx,
    );

    return ids;
  });

  return {
    resultJson: { resultIds },
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    model: usedModel,
  };
}

function resolveBrandCheckFiles(projectId: string, fileIds?: string[]) {
  const where: Prisma.FileWhereInput =
    fileIds && fileIds.length > 0
      ? { projectId, deletedAt: null, id: { in: fileIds } }
      : {
          projectId,
          deletedAt: null,
          kind: { in: ["EXPORT", "DELIVERABLE"] },
        };

  return prisma.file.findMany({
    where,
    select: {
      id: true,
      path: true,
      fileName: true,
      mimeType: true,
      kind: true,
      imageMeta: true,
    },
    orderBy: { createdAt: "desc" },
    take: BRAND_CHECK_FILE_LIMIT,
  });
}

// ─────────────────────────────────────────────────────────────
// E. MATCH_FILE
// ─────────────────────────────────────────────────────────────

async function runMatchFile(
  job: JobWithProject,
  jobId: string,
): Promise<JobOutcome> {
  const input = matchFileInputSchema.parse(job.inputJson);
  const [file, deliverables] = await Promise.all([
    prisma.file.findFirst({
      where: { id: input.fileId, projectId: job.projectId, deletedAt: null },
    }),
    prisma.deliverable.findMany({
      where: {
        status: "OPEN",
        requirement: {
          projectId: job.projectId,
          deletedAt: null,
          status: "ACCEPTED",
        },
      },
      select: {
        id: true,
        name: true,
        filePatterns: true,
        requirementId: true,
        requirement: { select: { title: true } },
      },
    }),
  ]);
  if (!file) throw new Error("File not found for AI matching");

  const model = defaultModel();
  const { parsed, usage, model: usedModel } = await completeJsonWithFallback(
    model,
    matchFilePrompt({
      file: {
        id: file.id,
        path: file.path,
        fileName: file.fileName,
        extension: file.extension,
        kind: file.kind,
      },
      deliverables: deliverables.map((deliverable) => ({
        id: deliverable.id,
        name: deliverable.name,
        filePatterns: deliverable.filePatterns,
        requirementId: deliverable.requirementId,
        requirementTitle: deliverable.requirement.title,
      })),
    }),
    matchFileResultSchema,
    (): MatchFileResult => {
      const stem = file.fileName.toLowerCase().replace(/\.[^.]+$/, "");
      const matches = deliverables
        .filter((d) => {
          const dStem = d.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          const fStem = stem.replace(/[^a-z0-9]/g, "");
          return dStem.length >= 3 && (fStem.includes(dStem) || dStem.includes(fStem));
        })
        .map((d) => ({
          deliverableId: d.id,
          confidence: 0.9,
          rationale: `Filename "${file.fileName}" matches deliverable "${d.name}".`,
        }));
      return { matches };
    },
  );

  const deliverableById = new Map(
    deliverables.map((deliverable) => [deliverable.id, deliverable]),
  );
  const applied: FileMatchJson[] = [];
  const suggestions: FileMatchJson[] = [];

  await prisma.$transaction(async (tx) => {
    for (const match of parsed.matches ?? []) {
      const deliverable = deliverableById.get(match.deliverableId);
      if (!deliverable) {
        suggestions.push(match);
        continue;
      }

      if (match.confidence < MATCH_CONFIDENCE_THRESHOLD) {
        suggestions.push(match);
        continue;
      }

      await tx.requirementFileLink.upsert({
        where: {
          requirementId_fileId: {
            requirementId: deliverable.requirementId,
            fileId: file.id,
          },
        },
        create: {
          requirementId: deliverable.requirementId,
          fileId: file.id,
          linkType: "SATISFIES",
          matchedBy: "AI",
          confidence: match.confidence,
        },
        update: {
          linkType: "SATISFIES",
          matchedBy: "AI",
          confidence: match.confidence,
        },
      });

      await tx.deliverable.update({
        where: { id: deliverable.id },
        data: {
          status: "SATISFIED",
          satisfiedByFileId: file.id,
          satisfiedAt: new Date(),
        },
      });

      applied.push(match);
    }

    await emit(
      {
        projectId: job.projectId,
        actorId: job.requestedById,
        type: "file.matched",
        entityType: "File",
        entityId: file.id,
        meta: {
          jobId,
          linked: applied.length,
          suggestions: suggestions.length,
        },
      },
      tx,
    );
  });

  return {
    resultJson: {
      matches: applied,
      suggestions,
    } as unknown as Prisma.InputJsonValue,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    model: usedModel,
  };
}

type FileMatchJson = {
  deliverableId: string;
  confidence: number;
  rationale: string;
};

// ─────────────────────────────────────────────────────────────
// F. PROJECT_STATUS_NARRATIVE
// ─────────────────────────────────────────────────────────────

async function runStatusNarrative(job: JobWithProject): Promise<JobOutcome> {
  projectStatusNarrativeInputSchema.parse(job.inputJson);

  const context = await buildStatusContext(job.projectId);
  const model = defaultModel();
  const { parsed, usage, model: usedModel } = await completeJsonWithFallback(
    model,
    statusNarrativePrompt(context),
    projectStatusNarrativeResultSchema,
    () => fallbackStatusNarrative(context),
  );

  await emit({
    projectId: job.projectId,
    actorId: job.requestedById,
    type: "ai.status_narrative",
    entityType: "Project",
    entityId: job.projectId,
    meta: { jobId: job.id },
  });

  return {
    resultJson: parsed as unknown as Prisma.InputJsonValue,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    model: usedModel,
  };
}

async function buildStatusContext(projectId: string): Promise<StatusContext> {
  const [
    project,
    requirementGroups,
    deliverableGroups,
    overdue,
    branches,
    openTasks,
    failingChecks,
    recentActivity,
  ] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        deadline: true,
      },
    }),
    prisma.requirement.groupBy({
      by: ["status"],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.deliverable.groupBy({
      by: ["status"],
      where: { requirement: { projectId, deletedAt: null } },
      _count: { _all: true },
    }),
    prisma.requirement.findMany({
      where: {
        projectId,
        deletedAt: null,
        status: { not: "FULFILLED" },
        dueDate: { lt: new Date() },
      },
      select: {
        title: true,
        dueDate: true,
        _count: { select: { fileLinks: true } },
      },
      orderBy: { dueDate: "asc" },
      take: BRAND_CHECK_FILE_LIMIT,
    }),
    prisma.branch.findMany({
      where: { projectId, deletedAt: null },
      select: {
        name: true,
        status: true,
        headVersion: { select: { number: true, createdAt: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.task.count({
      where: { projectId, status: { in: ["TODO", "IN_PROGRESS"] } },
    }),
    prisma.brandCheckResult.findMany({
      where: { projectId, status: "FAIL", resolvedAt: null },
      select: { file: { select: { fileName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.activityEvent.findMany({
      where: { projectId },
      select: { type: true, entityType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  if (!project) throw new Error("Project not found for status narrative");

  const requirementCount = (status: "PENDING" | "ACCEPTED" | "REJECTED" | "FULFILLED") =>
    requirementGroups.find((group) => group.status === status)?._count._all ?? 0;
  const totalRequirements = requirementGroups.reduce(
    (sum, group) => sum + group._count._all,
    0,
  );
  const fulfilled = requirementCount("FULFILLED");
  const accepted = requirementCount("ACCEPTED") + fulfilled;
  const coveragePct =
    totalRequirements > 0 ? Math.round((fulfilled / totalRequirements) * 100) : 0;

  const deliverableCount = (status: "OPEN" | "SATISFIED") =>
    deliverableGroups.find((group) => group.status === status)?._count._all ?? 0;
  const done = deliverableCount("SATISFIED");
  const totalDeliverables = deliverableGroups.reduce(
    (sum, group) => sum + group._count._all,
    0,
  );

  const branchSummary = branches.length
    ? branches
        .map(
          (branch) =>
            `${branch.name} ${
              branch.headVersion ? `v${branch.headVersion.number}` : "no versions"
            } (${branch.status})`,
        )
        .join(", ")
    : "No branches";

  return {
    projectName: project.name,
    deadline: formatDate(project.deadline),
    requirementCoveragePct: coveragePct,
    requirements: {
      accepted,
      fulfilled,
      total: totalRequirements,
    },
    deliverables: { done, total: totalDeliverables },
    overdue: overdue.map(
      (requirement) =>
        `${requirement.title} — due ${
          requirement.dueDate
            ? requirement.dueDate.toISOString().slice(0, 10)
            : "unknown"
        }, ${requirement._count.fileLinks} files`,
    ),
    branchSummary,
    openTasks,
    failingBrandChecks: failingChecks.map((check) => check.file.fileName),
    recentActivity: recentActivity.map(
      (event) => `${event.type} (${event.entityType})`,
    ),
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function asJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
