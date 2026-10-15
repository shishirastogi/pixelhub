import type { Prisma } from "@prisma/client";
import type {
  CreateProjectInput,
  InviteMemberInput,
  ListActivityQuery,
  MemberPermissionsInput,
  RequestProjectAccessInput,
  RespondInviteInput,
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
  return projects.map((project) => {
    const member = project.members[0];
    const role = member?.role ?? Role.CLIENT;
    const isStaff = role !== Role.CLIENT;
    return {
      ...project,
      role,
      permissions: {
        canViewFiles: isStaff ? true : (member?.canViewFiles ?? true),
        canDownloadFiles: isStaff ? true : (member?.canDownloadFiles ?? false),
        canViewBrief: isStaff ? true : (member?.canViewBrief ?? true),
        canComment: isStaff ? true : (member?.canComment ?? true),
        canApproveVersions: isStaff ? true : (member?.canApproveVersions ?? true),
      },
      members: undefined,
    };
  });
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const actor = await prisma.user.findUnique({ where: { id: userId } });
  if (!actor) throw AppError.unauthorized();
  if (actor.accountType === "CLIENT") {
    throw AppError.forbidden(
      "CLIENT_CANNOT_CREATE_PROJECT",
      "Client accounts cannot create studio projects — request access or accept an invitation instead.",
    );
  }

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

// ─────────────────────────────────────────────────────────────
// Members, Client Invitations & Access Requests
// ─────────────────────────────────────────────────────────────

export async function listProjectMembers(userId: string, idOrSlug: string) {
  const { project, membership } = await authorizeProject(
    userId,
    idOrSlug,
    ALL_ROLES,
  );

  const [members, invites] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            accountType: true,
            company: true,
            title: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    membership.role === Role.OWNER
      ? prisma.projectInvite.findMany({
          where: { projectId: project.id },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                accountType: true,
                company: true,
              },
            },
            invitedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return { members, invites, currentRole: membership.role };
}

export async function inviteMember(
  userId: string,
  idOrSlug: string,
  input: InviteMemberInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, OWNER_ONLY);
  const email = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: project.id, userId: existingUser.id },
      },
    });
    if (existingMember) {
      throw AppError.conflict(
        "ALREADY_MEMBER",
        "This user is already a member of the project",
      );
    }
  }

  const invite = await prisma.projectInvite.create({
    data: {
      projectId: project.id,
      email,
      userId: existingUser?.id ?? null,
      invitedById: userId,
      direction: "INVITE",
      role: input.role,
      status: "PENDING",
      message: input.message?.trim() || null,
      canViewFiles: input.canViewFiles,
      canDownloadFiles: input.canDownloadFiles,
      canViewBrief: input.canViewBrief,
      canComment: input.canComment,
      canApproveVersions: input.canApproveVersions,
    },
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "member.invited",
    entityType: "ProjectInvite",
    entityId: invite.id,
    meta: { email, role: input.role },
  });

  return invite;
}

export async function updateMemberPermissions(
  userId: string,
  idOrSlug: string,
  targetUserId: string,
  input: MemberPermissionsInput,
) {
  const { project } = await authorizeProject(userId, idOrSlug, OWNER_ONLY);
  if (targetUserId === userId && input.role && input.role !== Role.OWNER) {
    throw AppError.badRequest(
      "CANNOT_DEMOTE_OWNER",
      "Project owner cannot demote themselves",
    );
  }

  const updated = await prisma.projectMember.update({
    where: {
      projectId_userId: { projectId: project.id, userId: targetUserId },
    },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.canViewFiles !== undefined
        ? { canViewFiles: input.canViewFiles }
        : {}),
      ...(input.canDownloadFiles !== undefined
        ? { canDownloadFiles: input.canDownloadFiles }
        : {}),
      ...(input.canViewBrief !== undefined
        ? { canViewBrief: input.canViewBrief }
        : {}),
      ...(input.canComment !== undefined
        ? { canComment: input.canComment }
        : {}),
      ...(input.canApproveVersions !== undefined
        ? { canApproveVersions: input.canApproveVersions }
        : {}),
    },
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "member.permissions_updated",
    entityType: "ProjectMember",
    entityId: targetUserId,
    meta: input as Prisma.InputJsonValue,
  });

  return updated;
}

export async function removeMember(
  userId: string,
  idOrSlug: string,
  targetUserId: string,
) {
  const { project } = await authorizeProject(userId, idOrSlug, OWNER_ONLY);
  if (targetUserId === userId) {
    throw AppError.badRequest(
      "CANNOT_REMOVE_OWNER",
      "Project owner cannot remove themselves",
    );
  }

  await prisma.projectMember.delete({
    where: {
      projectId_userId: { projectId: project.id, userId: targetUserId },
    },
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "member.removed",
    entityType: "ProjectMember",
    entityId: targetUserId,
  });

  return { ok: true };
}

export async function listUserInvitesAndPortalData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized();

  const [receivedInvites, sentRequests, ownedProjectsWithRequests] =
    await Promise.all([
      prisma.projectInvite.findMany({
        where: {
          direction: "INVITE",
          OR: [{ userId }, { email: user.email.toLowerCase() }],
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              clientName: true,
              description: true,
              deadline: true,
            },
          },
          invitedBy: {
            select: { id: true, name: true, email: true, company: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.projectInvite.findMany({
        where: {
          direction: "REQUEST",
          OR: [{ userId }, { email: user.email.toLowerCase() }],
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              clientName: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.projectInvite.findMany({
        where: {
          direction: "REQUEST",
          status: "PENDING",
          project: {
            deletedAt: null,
            members: { some: { userId, role: Role.OWNER } },
          },
        },
        include: {
          project: { select: { id: true, name: true, slug: true } },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    receivedInvites,
    sentRequests,
    incomingRequests: ownedProjectsWithRequests,
  };
}

export async function requestProjectAccess(
  userId: string,
  input: RequestProjectAccessInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized();

  const project = await resolveProject(input.projectSlugOrId.trim());
  const existingMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId } },
  });
  if (existingMember) {
    throw AppError.conflict(
      "ALREADY_MEMBER",
      "You already have access to this project",
    );
  }

  const existingPending = await prisma.projectInvite.findFirst({
    where: {
      projectId: project.id,
      userId,
      status: "PENDING",
    },
  });
  if (existingPending) {
    throw AppError.conflict(
      "REQUEST_ALREADY_PENDING",
      "You already have a pending request or invitation for this project",
    );
  }

  const request = await prisma.projectInvite.create({
    data: {
      projectId: project.id,
      email: user.email.toLowerCase(),
      userId: user.id,
      direction: "REQUEST",
      role: Role.CLIENT,
      status: "PENDING",
      message: input.message?.trim() || null,
      canViewFiles: true,
      canDownloadFiles: false,
      canViewBrief: true,
      canComment: true,
      canApproveVersions: true,
    },
    include: {
      project: { select: { id: true, name: true, slug: true } },
    },
  });

  await emit({
    projectId: project.id,
    actorId: userId,
    type: "access.requested",
    entityType: "ProjectInvite",
    entityId: request.id,
    meta: { email: user.email, name: user.name },
  });

  return request;
}

export async function respondToInvite(
  userId: string,
  inviteId: string,
  input: RespondInviteInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized();

  const invite = await prisma.projectInvite.findUnique({
    where: { id: inviteId },
    include: { project: true },
  });
  if (!invite) throw AppError.notFound("ProjectInvite");
  if (invite.status !== "PENDING") {
    throw AppError.badRequest(
      "INVITE_ALREADY_HANDLED",
      "This invitation or request has already been handled",
    );
  }

  if (invite.direction === "INVITE") {
    // Only the invited user (by userId or matching email) can accept/decline an INVITE
    const matchesUser =
      invite.userId === userId ||
      invite.email.toLowerCase() === user.email.toLowerCase();
    if (!matchesUser) {
      throw AppError.forbidden(
        "FORBIDDEN",
        "This invitation belongs to another user",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectInvite.update({
        where: { id: invite.id },
        data: { status: input.status, userId },
      });

      if (input.status === "ACCEPTED") {
        await tx.projectMember.upsert({
          where: {
            projectId_userId: { projectId: invite.projectId, userId },
          },
          create: {
            projectId: invite.projectId,
            userId,
            role: invite.role,
            invitedBy: invite.invitedById,
            canViewFiles: invite.canViewFiles,
            canDownloadFiles: invite.canDownloadFiles,
            canViewBrief: invite.canViewBrief,
            canComment: invite.canComment,
            canApproveVersions: invite.canApproveVersions,
          },
          update: {
            role: invite.role,
            canViewFiles: invite.canViewFiles,
            canDownloadFiles: invite.canDownloadFiles,
            canViewBrief: invite.canViewBrief,
            canComment: invite.canComment,
            canApproveVersions: invite.canApproveVersions,
          },
        });
      }
      return row;
    });

    await emit({
      projectId: invite.projectId,
      actorId: userId,
      type: `invite.${input.status.toLowerCase()}`,
      entityType: "ProjectInvite",
      entityId: invite.id,
    });

    return updated;
  } else {
    // direction === "REQUEST": only the project OWNER can approve/decline
    await requireRole(userId, invite.projectId, OWNER_ONLY);

    const targetUser =
      invite.userId
        ? await prisma.user.findUnique({ where: { id: invite.userId } })
        : await prisma.user.findUnique({
            where: { email: invite.email.toLowerCase() },
          });

    if (!targetUser) {
      throw AppError.notFound("Requester user account");
    }

    const role = input.role ?? invite.role;
    const canViewFiles = input.canViewFiles ?? invite.canViewFiles;
    const canDownloadFiles = input.canDownloadFiles ?? invite.canDownloadFiles;
    const canViewBrief = input.canViewBrief ?? invite.canViewBrief;
    const canComment = input.canComment ?? invite.canComment;
    const canApproveVersions =
      input.canApproveVersions ?? invite.canApproveVersions;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectInvite.update({
        where: { id: invite.id },
        data: {
          status: input.status,
          role,
          canViewFiles,
          canDownloadFiles,
          canViewBrief,
          canComment,
          canApproveVersions,
        },
      });

      if (input.status === "ACCEPTED") {
        await tx.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: invite.projectId,
              userId: targetUser.id,
            },
          },
          create: {
            projectId: invite.projectId,
            userId: targetUser.id,
            role,
            invitedBy: userId,
            canViewFiles,
            canDownloadFiles,
            canViewBrief,
            canComment,
            canApproveVersions,
          },
          update: {
            role,
            canViewFiles,
            canDownloadFiles,
            canViewBrief,
            canComment,
            canApproveVersions,
          },
        });
      }
      return row;
    });

    await emit({
      projectId: invite.projectId,
      actorId: userId,
      type: `access_request.${input.status.toLowerCase()}`,
      entityType: "ProjectInvite",
      entityId: invite.id,
      meta: { requesterEmail: invite.email },
    });

    return updated;
  }
}
