import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ProjectWorkspaceShell } from "@/components/project-tabs";
import { AppError } from "@/server/errors";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { requireCurrentUser } from "@/server/auth/session";
import { listBranches } from "@/server/modules/branches/service";
import { getProject } from "@/server/modules/projects/service";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) {
  const user = await requireCurrentUser();

  let project;
  let branches;
  let auth;
  try {
    [project, branches, auth] = await Promise.all([
      getProject(user.id, params.slug),
      listBranches(user.id, params.slug),
      authorizeProject(user.id, params.slug, ALL_ROLES),
    ]);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.status === 404 || error.status === 403)
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <ProjectWorkspaceShell
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        status: project.status,
        clientName: project.clientName,
        deadline: project.deadline ? project.deadline.toISOString() : null,
        defaultBranchId: project.defaultBranchId,
        counts: {
          files: project._count.files,
          requirements: project._count.requirements,
          tasks: project._count.tasks,
          branches: project._count.branches,
        },
      }}
      branches={branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        kind: branch.kind,
        status: branch.status,
        fileCount: branch.fileCount,
      }))}
      members={project.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        canViewFiles: m.canViewFiles,
        canDownloadFiles: m.canDownloadFiles,
        canViewBrief: m.canViewBrief,
        canComment: m.canComment,
        canApproveVersions: m.canApproveVersions,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          accountType: m.user.accountType,
          company: m.user.company,
          title: m.user.title,
        },
      }))}
      membership={{
        role: auth.membership.role,
        canViewFiles: auth.membership.canViewFiles,
        canDownloadFiles: auth.membership.canDownloadFiles,
        canViewBrief: auth.membership.canViewBrief,
        canComment: auth.membership.canComment,
        canApproveVersions: auth.membership.canApproveVersions,
      }}
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        company: user.company,
        title: user.title,
      }}
    >
      {children}
    </ProjectWorkspaceShell>
  );
}
