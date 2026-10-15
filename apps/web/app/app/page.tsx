import { StudioPortalDashboard } from "@/components/studio-portal-dashboard";
import { requireCurrentUser } from "@/server/auth/session";
import {
  listProjects,
  listUserInvitesAndPortalData,
} from "@/server/modules/projects/service";

export const dynamic = "force-dynamic";

export default async function MyProjectsPage() {
  const user = await requireCurrentUser();
  const [projects, portalData] = await Promise.all([
    listProjects(user.id),
    listUserInvitesAndPortalData(user.id),
  ]);

  return (
    <StudioPortalDashboard
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        company: user.company,
        title: user.title,
      }}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        clientName: p.clientName,
        description: p.description,
        deadline: p.deadline ? p.deadline.toISOString() : null,
        status: p.status,
        role: p.role,
        defaultBranch: p.defaultBranch
          ? { id: p.defaultBranch.id, name: p.defaultBranch.name }
          : null,
        counts: {
          files: p._count.files,
          requirements: p._count.requirements,
          members: p._count.members,
        },
        permissions: p.permissions,
      }))}
      receivedInvites={portalData.receivedInvites.map((inv) => ({
        id: inv.id,
        projectId: inv.projectId,
        email: inv.email,
        direction: inv.direction,
        role: inv.role,
        status: inv.status,
        message: inv.message,
        canViewFiles: inv.canViewFiles,
        canDownloadFiles: inv.canDownloadFiles,
        canViewBrief: inv.canViewBrief,
        canComment: inv.canComment,
        canApproveVersions: inv.canApproveVersions,
        createdAt: inv.createdAt.toISOString(),
        project: {
          id: inv.project.id,
          name: inv.project.name,
          slug: inv.project.slug,
          clientName: inv.project.clientName,
          description: inv.project.description,
        },
        invitedBy: inv.invitedBy ?? null,
      }))}
      sentRequests={portalData.sentRequests.map((req) => ({
        id: req.id,
        projectId: req.projectId,
        email: req.email,
        direction: req.direction,
        role: req.role,
        status: req.status,
        message: req.message,
        canViewFiles: req.canViewFiles,
        canDownloadFiles: req.canDownloadFiles,
        canViewBrief: req.canViewBrief,
        canComment: req.canComment,
        canApproveVersions: req.canApproveVersions,
        createdAt: req.createdAt.toISOString(),
        project: {
          id: req.project.id,
          name: req.project.name,
          slug: req.project.slug,
          clientName: req.project.clientName,
          description: req.project.description,
        },
      }))}
      incomingRequests={portalData.incomingRequests.map((req) => ({
        id: req.id,
        projectId: req.projectId,
        email: req.email,
        direction: req.direction,
        role: req.role,
        status: req.status,
        message: req.message,
        canViewFiles: req.canViewFiles,
        canDownloadFiles: req.canDownloadFiles,
        canViewBrief: req.canViewBrief,
        canComment: req.canComment,
        canApproveVersions: req.canApproveVersions,
        createdAt: req.createdAt.toISOString(),
        project: {
          id: req.project.id,
          name: req.project.name,
          slug: req.project.slug,
        },
        user: req.user ?? null,
      }))}
    />
  );
}
