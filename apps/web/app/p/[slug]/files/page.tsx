import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { listFiles } from "@/server/modules/files/service";
import { listBranches } from "@/server/modules/branches/service";
import { listWatcherDevices } from "@/server/modules/watchers/service";
import FilesTab from "@/components/files/FilesTab";

export const dynamic = "force-dynamic";

export default async function FilesPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project } = await authorizeProject(user.id, params.slug, ALL_ROLES);

  const [files, branches, devices] = await Promise.all([
    listFiles(project, { limit: 50 }),
    listBranches(user.id, params.slug).catch(() => []),
    listWatcherDevices(project.id),
  ]);

  return (
    <FilesTab
      projectId={project.id}
      projectSlug={project.slug}
      initialFiles={files.items.map((file) => ({
        id: file.id,
        path: file.path,
        fileName: file.fileName,
        extension: file.extension,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes.toString(),
        kind: file.kind,
        createdAt: file.createdAt.toISOString(),
        imageMeta:
          (file.imageMeta as { width?: number; height?: number } | null) ??
          null,
        linkedRequirementCount: file.linkedRequirementCount,
      }))}
      initialNextCursor={files.nextCursor}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      defaultBranchId={project.defaultBranchId}
      devices={devices.map((device) => ({
        id: device.id,
        name: device.name,
        createdAt: device.createdAt.toISOString(),
        lastSeenAt: device.lastSeenAt
          ? device.lastSeenAt.toISOString()
          : null,
      }))}
    />
  );
}
