import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { listBranches } from "@/server/modules/branches/service";
import { listVersions } from "@/server/modules/versions/service";
import VersionsTab from "@/components/versions/VersionsTab";

export const dynamic = "force-dynamic";

export default async function VersionsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project, membership } = await authorizeProject(
    user.id,
    params.slug,
    ALL_ROLES,
  );

  const branches = await listBranches(user.id, params.slug);
  const defaultBranch =
    branches.find((branch) => branch.id === project.defaultBranchId) ??
    branches[0] ??
    null;
  const versions = defaultBranch
    ? await listVersions(user.id, defaultBranch.id)
    : [];

  return (
    <VersionsTab
      projectId={project.id}
      projectSlug={project.slug}
      isClient={membership.role === "CLIENT"}
      canApproveVersions={membership.canApproveVersions}
      canComment={membership.canComment}
      canDownload={membership.canDownloadFiles}
      initialBranches={branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        kind: branch.kind,
        status: branch.status,
        parentBranchId: branch.parentBranchId,
        fileCount: branch.fileCount,
        headVersion: branch.headVersion
          ? {
              id: branch.headVersion.id,
              number: branch.headVersion.number,
              label: branch.headVersion.label,
            }
          : null,
      }))}
      defaultBranchId={project.defaultBranchId}
      initialVersions={versions.map((version) => ({
        id: version.id,
        number: version.number,
        label: version.label,
        note: version.note,
        createdAt: version.createdAt.toISOString(),
        fileCount: version.fileCount,
        createdBy: version.createdBy
          ? { id: version.createdBy.id, name: version.createdBy.name }
          : null,
        sourceBranch: version.sourceBranch
          ? {
              id: version.sourceBranch.id,
              name: version.sourceBranch.name,
              kind: version.sourceBranch.kind,
            }
          : null,
      }))}
    />
  );
}
