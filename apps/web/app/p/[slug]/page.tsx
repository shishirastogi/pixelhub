import { ActivityFeed } from "@/components/activity-feed";
import { AiNarrativeTile } from "@/components/ai-narrative-tile";
import { GettingStarted } from "@/components/getting-started";
import { PulseTiles } from "@/components/pulse-tiles";
import { requireCurrentUser } from "@/server/auth/session";
import { getBrief } from "@/server/modules/briefs/service";
import { listFiles } from "@/server/modules/files/service";
import {
  getProject,
  getPulse,
  listActivity,
} from "@/server/modules/projects/service";
import { listRequirements } from "@/server/modules/requirements/service";
import { listVersions } from "@/server/modules/versions/service";
import { listWatcherDevices } from "@/server/modules/watchers/service";

export const dynamic = "force-dynamic";

export default async function PulsePage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();

  const project = await getProject(user.id, params.slug);
  const [pulse, activity, brief, requirements, devices, files, versions] =
    await Promise.all([
      getPulse(user.id, params.slug),
      listActivity(user.id, params.slug, { limit: 8 }),
      getBrief(user.id, params.slug),
      listRequirements(user.id, params.slug, {}),
      listWatcherDevices(project.id),
      listFiles(project, { limit: 1 }),
      project.defaultBranchId
        ? listVersions(user.id, project.defaultBranchId)
        : Promise.resolve([]),
    ]);

  const slug = project.slug;
  const steps = [
    {
      label: "Paste the client brief",
      hint: "So requirements and AI extraction have context.",
      href: `/p/${slug}/brief`,
      done: Boolean(brief?.rawText?.trim()),
    },
    {
      label: "Add requirements & deliverables",
      hint: "With file patterns so uploads auto-satisfy them.",
      href: `/p/${slug}/brief`,
      done: requirements.length > 0,
    },
    {
      label: "Snapshot a version",
      hint: "Freeze a checkpoint you can compare against later.",
      href: `/p/${slug}/versions`,
      done: versions.length > 0,
    },
    {
      label: "Pair your project folder",
      hint: "The watcher keeps files and deliverables in sync.",
      href: `/p/${slug}/settings`,
      done: devices.length > 0,
    },
    {
      label: "Upload or watch files",
      hint: "Exports matching a pattern flip deliverables to fulfilled.",
      href: `/p/${slug}/files`,
      done: files.items.length > 0,
    },
  ];

  return (
    <div className="space-y-4">
      <GettingStarted steps={steps} />
      <PulseTiles pulse={pulse} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed items={activity.items} />
        </div>
        <AiNarrativeTile projectId={project.id} />
      </div>
    </div>
  );
}
