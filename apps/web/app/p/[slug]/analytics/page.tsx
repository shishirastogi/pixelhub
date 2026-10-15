import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import {
  computeMetrics,
  getRequirementAnalytics,
} from "@/server/modules/analytics/service";
import AnalyticsTab from "@/components/analytics/AnalyticsTab";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project } = await authorizeProject(user.id, params.slug, ALL_ROLES);

  const [metrics, reqAnalytics] = await Promise.all([
    computeMetrics(project.id),
    getRequirementAnalytics(user.id, params.slug),
  ]);

  return (
    <AnalyticsTab
      projectId={project.id}
      initialMetrics={metrics}
      initialTrend={reqAnalytics.trend}
    />
  );
}
