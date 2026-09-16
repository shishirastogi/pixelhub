import type { Prisma } from "@prisma/client";
import type {
  CreateProjectInput,
  ListActivityQuery,
  UpdateProjectInput,
} from "@pixelhub/types/contracts/projects";
import { Role } from "@pixelhub/types";
import { emit } from "../../activity";
import { prisma, type Db } from "../../db";
import { AppError } from "../../errors";
import { slugify } from "../../slug";
import {
  ALL_ROLES,
  EDITORS,
  OWNER_ONLY,
  authorizeProject,
  requireRole,
  resolveProject,
} from "../../auth/permissions";
import * as repo from "./repo";

async function uniqueProjectSlug(name: string, db: Db): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (await repo.projectSlugExists(candidate, db)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

export async function listProjects(userId: string) {
  const projects = await repo.findProjectsForUser(userId);
  return projects.map((project) => ({
    ...project,
    role: project.members[0]?.role ?? Role.CLIENT,
    members: undefined,
  }));
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const project = await prisma.$transaction(async (tx) => {
    const slug = await uniqueProjectSlug(input.name, tx);

    const branches = [
      { name: "Main Concept", slug: "main", kind: "MAIN" as const },
      ...(input.createExperimentalBranch
        ? [{ name: "Experimental", slug: "experimental", kind: "EXPERIMENTAL" as const }]
        : []),
    ];

    const created = await repo.createProject(
      {
        name: input.name.trim(),
        slug,
        clientName: input.clientName ?? null,
        description: input.description ?? null,
        deadline: input.deadline ? new Date(input.deadline) : null,
        aiEnabled: input.aiEnabled ?? true,
        members: { create: { userId, role: Role.OWNER } },
        brandKit: { create: { name: `${input.name.trim()} Brand Kit` } },
        branches: { create: branches },
      },
      tx,
    );

    const main = created.branches.find((branch) => branch.kind === "MAIN");
    if (!main) throw new AppError("BRANCH_INIT_FAILED", "Default branch was not created", 500);
    await repo.setDefaultBranch(created.id, main.id, tx);

    if (input.briefText && input.briefText.trim().length > 0) {
      await tx.brief.create({
        data: { projectId: created.id, title: "Brief", rawText: input.briefText },
      });
    }

    await emit(
      {
        projectId: created.id,
        actorId: userId,
        type: "project.created",
        entityType: "Project",
        entityId: created.id,
        meta: { name: created.name },
      },
      tx,
    );

    return created;
  });

  return getProject(userId, project.id);
}

export async function getProject(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  const detail = await repo.findProjectDetail(project.id);
  if (!detail) throw AppError.notFound("Project");
  return detail;
}

export async function updateProject(
  userId: string,
  idOrSlug: string,
  input: UpdateProjectInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, EDITORS);

  if (input.aiEnabled !== undefined || input.status !== undefined) {
    await requireRole(userId, project.id, OWNER_ONLY);
  }

  const updated = await repo.updateProject(project.id, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.clientName !== undefined ? { clientName: input.clientName } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.deadline !== undefined
      ? { deadline: input.deadline ? new Date(input.deadline) : null }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.aiEnabled !== undefined ? { aiEnabled: input.aiEnabled } : {}),
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "project.updated",
    entityType: "Project",
    entityId: project.id,
    meta: input as Prisma.InputJsonValue,
  });

  return updated;
}

export async function deleteProject(userId: string, idOrSlug: string) {
  const { project } = await authorizeProject(userId, idOrSlug, OWNER_ONLY);
  await repo.softDeleteProject(project.id);
  await emit({
    projectId: project.id,
    actorId: userId,
    type: "project.deleted",
    entityType: "Project",
    entityId: project.id,
  });
  return { ok: true };
}

export async function getPulse(userId: string, idOrSlug: string) {
  const project = await resolveProject(idOrSlug);
  await requireRole(userId, project.id, ALL_ROLES);

  const [withHead, requirements, openTasks, brandFails] = await Promise.all([
    repo.findProjectBranchHead(project.id),
    repo.findAcceptedRequirements(project.id),
    repo.countOpenTasks(project.id),
    repo.findFailingBrandChecks(project.id),
  ]);

  const deliverables = requirements.flatMap((requirement) => requirement.deliverables);
  const done = deliverables.filter((d) => d.status === "SATISFIED").length;
  const fulfilled = requirements.filter((r) => r.status === "FULFILLED").length;
  const coveragePct =
    requirements.length > 0 ? Math.round((fulfilled / requirements.length) * 100) : 0;

  const now = Date.now();
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

  type AttentionItem = {
    type: string;
    severity: "INFO" | "WARNING" | "ERROR";
    title: string;
    message: string;
    entityType: string;
    entityId: string;
  };
  const attentionItems: AttentionItem[] = [];

  for (const requirement of requirements) {
    if (
      requirement.status !== "FULFILLED" &&
      requirement.dueDate &&
      requirement.dueDate.getTime() < now
    ) {
      attentionItems.push({
        type: "OVERDUE_REQUIREMENT",
        severity: "ERROR",
        title: requirement.title,
        message: `Past due (${requirement.dueDate.toISOString().slice(0, 10)})`,
        entityType: "Requirement",
        entityId: requirement.id,
      });
    }
    if (
      requirement.status === "ACCEPTED" &&
      requirement._count.fileLinks === 0 &&
      requirement.createdAt.getTime() < threeDaysAgo
    ) {
      attentionItems.push({
        type: "REQUIREMENT_NO_FILES",
        severity: "WARNING",
        title: requirement.title,
        message: "No files linked after 3+ days",
        entityType: "Requirement",
        entityId: requirement.id,
      });
    }
  }

  for (const check of brandFails) {
    attentionItems.push({
      type: "BRAND_CHECK_FAILED",
      severity: "ERROR",
      title: check.file.fileName,
      message: "Fails a brand rule",
      entityType: "BrandCheckResult",
      entityId: check.id,
    });
  }

  const branch = withHead?.defaultBranch ?? null;

  return {
    deliverables: { done, total: deliverables.length },
    requirementCoveragePct: coveragePct,
    fulfilledRequirements: fulfilled,
    acceptedRequirements: requirements.length,
    openTasks,
    currentBranch: branch
      ? { id: branch.id, name: branch.name, kind: branch.kind }
      : null,
    latestVersion: branch?.headVersion
      ? {
          id: branch.headVersion.id,
          number: branch.headVersion.number,
          label: branch.headVersion.label,
          createdAt: branch.headVersion.createdAt,
        }
      : null,
    attentionItems,
  };
}

export async function listActivity(
  userId: string,
  idOrSlug: string,
  query: ListActivityQuery,
) {
  const { project } = await authorizeProject(userId, idOrSlug, ALL_ROLES);
  return repo.listActivity(project.id, query);
}
