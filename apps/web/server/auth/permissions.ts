import { Role } from "@pixelhub/types";
import type { Project } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../errors";

/** Higher rank inherits lower-rank capabilities. */
export const ROLE_RANK: Record<Role, number> = {
  CLIENT: 0,
  REVIEWER: 1,
  CONTRIBUTOR: 2,
  OWNER: 3,
};

export interface Membership {
  projectId: string;
  userId: string;
  role: Role;
  canViewFiles: boolean;
  canDownloadFiles: boolean;
  canViewBrief: boolean;
  canComment: boolean;
  canApproveVersions: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Accepts either a project id or a slug (frontend uses slugs). */
export async function resolveProject(idOrSlug: string): Promise<Project> {
  const or = isUuid(idOrSlug)
    ? [{ slug: idOrSlug }, { id: idOrSlug }]
    : [{ slug: idOrSlug }];

  const project = await prisma.project.findFirst({
    where: { deletedAt: null, OR: or },
  });

  if (!project) throw AppError.notFound("Project");
  return project;
}

export async function getMembership(
  userId: string,
  projectId: string,
): Promise<Membership | null> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) return null;
  const isStaff = member.role !== Role.CLIENT;
  return {
    projectId: member.projectId,
    userId: member.userId,
    role: member.role,
    canViewFiles: isStaff ? true : member.canViewFiles,
    canDownloadFiles: isStaff ? true : member.canDownloadFiles,
    canViewBrief: isStaff ? true : member.canViewBrief,
    canComment: isStaff ? true : member.canComment,
    canApproveVersions: isStaff ? true : member.canApproveVersions,
  };
}

export async function requireRole(
  userId: string,
  projectId: string,
  allowed: readonly Role[],
): Promise<Membership> {
  const membership = await getMembership(userId, projectId);
  if (!membership) throw AppError.forbidden("NOT_A_MEMBER", "You are not a member of this project");
  if (!allowed.includes(membership.role)) {
    throw AppError.forbidden("ROLE_FORBIDDEN", "Your role does not allow this action");
  }
  return membership;
}

export async function requireAtLeast(
  userId: string,
  projectId: string,
  minimum: Role,
): Promise<Membership> {
  const membership = await getMembership(userId, projectId);
  if (!membership) throw AppError.forbidden("NOT_A_MEMBER", "You are not a member of this project");
  if (ROLE_RANK[membership.role] < ROLE_RANK[minimum]) {
    throw AppError.forbidden("ROLE_FORBIDDEN", "Your role does not allow this action");
  }
  return membership;
}

/** Resolve project by id-or-slug + assert the user's role in one call. */
export async function authorizeProject(
  userId: string,
  idOrSlug: string,
  allowed: readonly Role[],
): Promise<{ project: Project; membership: Membership }> {
  const project = await resolveProject(idOrSlug);
  const membership = await requireRole(userId, project.id, allowed);
  return { project, membership };
}

export const ALL_ROLES: readonly Role[] = [
  Role.OWNER,
  Role.CONTRIBUTOR,
  Role.REVIEWER,
  Role.CLIENT,
];

/** Roles allowed to edit design output (owner/contributor/reviewer). */
export const EDITORS: readonly Role[] = [Role.OWNER, Role.CONTRIBUTOR];
export const OWNER_ONLY: readonly Role[] = [Role.OWNER];
