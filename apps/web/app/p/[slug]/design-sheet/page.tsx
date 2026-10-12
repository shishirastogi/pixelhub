import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { listDesignSheetItems } from "@/server/modules/design-sheet/service";
import { listRequirements } from "@/server/modules/requirements/service";
import DesignSheetTab from "@/components/design-sheet/DesignSheetTab";

export const dynamic = "force-dynamic";

export default async function DesignSheetPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project } = await authorizeProject(user.id, params.slug, ALL_ROLES);

  const [items, requirements] = await Promise.all([
    listDesignSheetItems(user.id, params.slug),
    listRequirements(user.id, params.slug, {}),
  ]);

  return (
    <DesignSheetTab
      projectId={project.id}
      projectSlug={project.slug}
      initialItems={items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        fileId: item.fileId,
        boardGroup: item.boardGroup,
        linkedRequirementId: item.linkedRequirementId,
        createdAt: item.createdAt.toISOString(),
      }))}
      requirements={requirements
        .filter(
          (requirement) =>
            requirement.status === "ACCEPTED" ||
            requirement.status === "FULFILLED",
        )
        .map((requirement) => ({
          id: requirement.id,
          title: requirement.title,
        }))}
    />
  );
}
