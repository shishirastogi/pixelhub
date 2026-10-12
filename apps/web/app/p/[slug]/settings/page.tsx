import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { listWatcherDevices } from "@/server/modules/watchers/service";
import SettingsTab from "@/components/settings/SettingsTab";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project } = await authorizeProject(user.id, params.slug, ALL_ROLES);
  const devices = await listWatcherDevices(project.id);

  return (
    <SettingsTab
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        clientName: project.clientName,
        description: project.description,
        deadline: project.deadline ? project.deadline.toISOString() : null,
        status: project.status,
        aiEnabled: project.aiEnabled,
      }}
      initialDevices={devices.map((device) => ({
        id: device.id,
        name: device.name,
        createdAt: device.createdAt.toISOString(),
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
      }))}
    />
  );
}
