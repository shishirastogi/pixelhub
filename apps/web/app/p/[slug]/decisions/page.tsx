import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { listDecisions } from "@/server/modules/decisions/service";
import { listBranches } from "@/server/modules/branches/service";
import { listVersions } from "@/server/modules/versions/service";
import DecisionsTab from "@/components/decisions/DecisionsTab";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project } = await authorizeProject(user.id, params.slug, ALL_ROLES);

  const [decisions, branches] = await Promise.all([
    listDecisions(user.id, params.slug, {}),
    listBranches(user.id, params.slug),
  ]);

  const versionGroups = await Promise.all(
    branches.map(async (branch) => ({
      branchName: branch.name,
      versions: await listVersions(user.id, branch.id),
    })),
  );

  const versions = versionGroups.flatMap((g) =>
    g.versions.map((v) => ({
      id: v.id,
      number: v.number,
      label: v.label,
      branchName: g.branchName,
    })),
  );

  return (
    <DecisionsTab
      projectId={project.id}
      initialDecisions={decisions.map((d) => ({
        id: d.id,
        title: d.title,
        decision: d.decision,
        reason: d.reason,
        status: d.status,
        versionId: d.versionId,
        designSheetItemId: d.designSheetItemId,
        decidedAt: d.decidedAt ? d.decidedAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
        decidedBy: d.decidedBy ?? null,
        version: d.version ?? null,
      }))}
      versions={versions}
    />
  );
}
