import { ActivityFeed } from "@/components/activity-feed";
import { AiNarrativeTile } from "@/components/ai-narrative-tile";
import { PulseTiles } from "@/components/pulse-tiles";
import { requireCurrentUser } from "@/server/auth/session";
import {
  getProject,
  getPulse,
  listActivity,
} from "@/server/modules/projects/service";

export default async function PulsePage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();

  const project = await getProject(user.id, params.slug);
  const [pulse, activity] = await Promise.all([
    getPulse(user.id, params.slug),
    listActivity(user.id, params.slug, { limit: 8 }),
  ]);

  return (
    <div className="space-y-4">
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
