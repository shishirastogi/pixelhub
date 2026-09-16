import type { Prisma } from "@prisma/client";
import type { AiUsage } from "@pixelhub/ai";
import type { ZodType } from "zod";
import { emit } from "../../activity";
import { getAiProvider, defaultModel, visionModel } from "../../ai/provider";
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

async function completeJson<T>(
  model: string,
  prompt: PromptBundle,
  schema: ZodType<T>,
): Promise<{ parsed: T; usage: AiUsage }> {
  const completion = await getAiProvider().complete({
    model,
    system: prompt.system,
    messages: prompt.messages,
    json: schema,
  });
  if (completion.parsed === undefined) {
    throw new Error("AI provider returned no parsed JSON output");
  }
  return { parsed: completion.parsed, usage: completion.usage };
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
  const { parsed, usage } = await completeJson(
    model,
    extractRequirementsPrompt(brief.rawText),
    extractRequirementsResultSchema,
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
    model,
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
  const { parsed, usage } = await completeJson(
    model,
    generateTasksPrompt({
      projectName: job.project.name,
      requirementTitle: requirement.title,
      requirementDescription: requirement.description,
      deadline: formatDate(job.project.deadline),
    }),
    generateTasksResultSchema,
  );

  const now = Date.now();
  const taskIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];

    for (const task of parsed.tasks) {
      const created = await tx.task.create({
        data: {
          projectId: job.projectId,
          requirementId: requirement.id,
          title: task.title,
          description: task.description ?? null,
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
    model,
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
  const { parsed, usage } = await completeJson(
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
    model,
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
  const [brandKit, files] = await Promise.all([
    prisma.brandKit.findUnique({
      where: { projectId: job.projectId },
      include: { colors: true, fonts: true, logos: true, rules: true },
    }),
    resolveBrandCheckFiles(job.projectId, input.fileIds),
  ]);

  const model = visionModel();
  const { parsed, usage } = await completeJson(
    model,
    brandCheckPrompt({ brandKit, files }),
    brandCheckResultSchema,
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
      const status = findings.length > 0 ? parsed.verdict : "PASS";
      const checkType = findings[0]?.checkType ?? "RULE";

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
    model,
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
  const { parsed, usage } = await completeJson(
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
    model,
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
  const { parsed, usage } = await completeJson(
    model,
    statusNarrativePrompt(context),
    projectStatusNarrativeResultSchema,
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
    model,
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
