import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { listBranches } from "@/server/modules/branches/service";
import { listVersions } from "@/server/modules/versions/service";
import CompareView, {
  type VersionOption,
} from "@/components/compare/CompareView";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { base?: string; target?: string };
}) {
  const user = await requireCurrentUser();
  await authorizeProject(user.id, params.slug, ALL_ROLES);

  const branches = await listBranches(user.id, params.slug);
  const groups = await Promise.all(
    branches.map(async (branch) => ({
      branchId: branch.id,
      branchName: branch.name,
      versions: await listVersions(user.id, branch.id),
    })),
  );

  const versions: VersionOption[] = groups.flatMap((group) =>
    group.versions.map((version) => ({
      id: version.id,
      branchId: group.branchId,
      branchName: group.branchName,
      number: version.number,
      label: version.label,
      createdAt: version.createdAt.toISOString(),
      fileCount: version.fileCount,
    })),
  );

  return (
    <CompareView
      versions={versions}
      initialBaseId={searchParams.base ?? ""}
      initialTargetId={searchParams.target ?? ""}
    />
  );
}
