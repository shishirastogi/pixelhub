import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import {
  getBrandKit,
  listBrandChecks,
} from "@/server/modules/brandkit/service";
import BrandKitTab from "@/components/brandkit/BrandKitTab";

export const dynamic = "force-dynamic";

export default async function BrandKitPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project } = await authorizeProject(user.id, params.slug, ALL_ROLES);

  const [kit, checks] = await Promise.all([
    getBrandKit(user.id, params.slug),
    listBrandChecks(user.id, params.slug, {}),
  ]);

  return (
    <BrandKitTab
      projectId={project.id}
      initialKit={{
        name: kit?.name ?? `${project.name} Brand Kit`,
        guidelinesText: kit?.guidelinesText ?? null,
        colors: (kit?.colors ?? []).map((color) => ({
          name: color.name,
          hex: color.hex,
          role: color.role,
          tolerance: color.tolerance,
        })),
        fonts: (kit?.fonts ?? []).map((font) => ({
          family: font.family,
          role: font.role,
        })),
        logos: (kit?.logos ?? []).map((logo) => ({
          name: logo.name,
          variant: logo.variant,
          fileId: logo.fileId,
          isCurrent: logo.isCurrent,
        })),
        rules: (kit?.rules ?? []).map((rule) => ({
          ruleType: rule.ruleType,
          payload: rule.payload,
          severity: rule.severity,
        })),
      }}
      initialChecks={checks.items.map((check) => ({
        id: check.id,
        status: check.status,
        checkType: check.checkType,
        findings: check.findings,
        resolvedAt: check.resolvedAt ? check.resolvedAt.toISOString() : null,
        createdAt: check.createdAt.toISOString(),
        file: {
          id: check.file.id,
          fileName: check.file.fileName,
          path: check.file.path,
        },
      }))}
    />
  );
}
