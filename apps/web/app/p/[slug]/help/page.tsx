import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { HelpCenterView } from "@/components/help/HelpCenterView";

export const dynamic = "force-dynamic";

export default async function ProjectHelpPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project } = await authorizeProject(user.id, params.slug, ALL_ROLES);

  return (
    <HelpCenterView
      projectId={project.id}
      projectName={project.name}
      userAccountType={user.accountType}
      userName={user.name}
    />
  );
}
