import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { getBrief } from "@/server/modules/briefs/service";
import { listRequirements } from "@/server/modules/requirements/service";
import BriefTab from "@/components/brief/BriefTab";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/form";

export const dynamic = "force-dynamic";

export default async function BriefPage({
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

  if (!membership.canViewBrief) {
    return (
      <Card>
        <EmptyState
          title="Brief viewing is restricted for your role"
          description="The project owner has restricted access to the full brief document. You can still view overall deliverable progress on the Dashboard."
        />
      </Card>
    );
  }

  const [brief, requirements] = await Promise.all([
    getBrief(user.id, params.slug),
    listRequirements(user.id, params.slug, {}),
  ]);

  return (
    <BriefTab
      projectId={project.id}
      initialBrief={
        brief
          ? {
              id: brief.id,
              title: brief.title,
              rawText: brief.rawText,
              updatedAt: brief.updatedAt.toISOString(),
              sourceFile: brief.sourceFile,
            }
          : null
      }
      initialRequirements={requirements.map((requirement) => ({
        id: requirement.id,
        title: requirement.title,
        description: requirement.description,
        status: requirement.status,
        source: requirement.source,
        quantity: requirement.quantity,
        dueDate: requirement.dueDate ? requirement.dueDate.toISOString() : null,
        priority: requirement.priority,
        createdAt: requirement.createdAt.toISOString(),
        coverage: requirement.coverage,
        deliverables: requirement.deliverables.map((deliverable) => ({
          id: deliverable.id,
          name: deliverable.name,
          filePatterns: deliverable.filePatterns,
          status: deliverable.status,
          satisfiedByFileId: deliverable.satisfiedByFileId,
        })),
      }))}
    />
  );
}
