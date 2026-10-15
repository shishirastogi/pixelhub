import { ActivityFeed } from "@/components/activity-feed";
import { AiNarrativeTile } from "@/components/ai-narrative-tile";
import { ClientReviewPanel } from "@/components/client-review-panel";
import { DesignerCollaborationHub } from "@/components/designer-collaboration-hub";
import { GettingStarted } from "@/components/getting-started";
import { PulseTiles } from "@/components/pulse-tiles";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { requireCurrentUser } from "@/server/auth/session";
import { getBrief } from "@/server/modules/briefs/service";
import { listProjectComments } from "@/server/modules/comments/service";
import { listFiles } from "@/server/modules/files/service";
import {
  getProject,
  getPulse,
  listActivity,
  listProjectMembers,
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

  const [project, auth] = await Promise.all([
    getProject(user.id, params.slug),
    authorizeProject(user.id, params.slug, ALL_ROLES),
  ]);
  const [
    pulse,
    activity,
    brief,
    requirements,
    devices,
    files,
    versions,
    projectComments,
    memberData,
  ] = await Promise.all([
    getPulse(user.id, params.slug),
    listActivity(user.id, params.slug, { limit: 8 }),
    getBrief(user.id, params.slug),
    listRequirements(user.id, params.slug, {}),
    listWatcherDevices(project.id),
    listFiles(project, { limit: 25 }),
    project.defaultBranchId
      ? listVersions(user.id, project.defaultBranchId)
      : Promise.resolve([]),
    listProjectComments(user.id, params.slug).catch(() => []),
    listProjectMembers(user.id, params.slug),
  ]);

  const slug = project.slug;
  const isClient = auth.membership.role === "CLIENT";
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

  const activeRequirements = requirements
    .filter((r) => r.status !== "REJECTED" && r.status !== "PENDING")
    .map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      quantity: r.quantity,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      coverage: r.coverage,
      patternHint:
        r.deliverables
          .flatMap((d) => d.filePatterns)
          .slice(0, 2)
          .join(", ") || `${r.deliverables.length} deliverables`,
    }));

  const pendingProposals = requirements
    .filter((r) => r.status === "PENDING")
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      quantity: r.quantity,
      priority: r.priority,
    }));

  const pendingAccessRequests = memberData.invites
    .filter((inv) => inv.direction === "REQUEST" && inv.status === "PENDING")
    .map((inv) => ({
      id: inv.id,
      email: inv.email,
      message: inv.message,
      createdAt: inv.createdAt.toISOString(),
      user: inv.user ? { name: inv.user.name, company: inv.user.company } : null,
    }));

  const defaultSummary = `Requirement coverage is at ${pulse.requirementCoveragePct}% (${pulse.deliverables.done}/${pulse.deliverables.total} deliverables matched across ${files.items.length} tracked files).`;

  return (
    <div className="space-y-5">
      {isClient ? (
        <ClientReviewPanel
          projectSlug={slug}
          branchId={pulse.currentBranch?.id ?? null}
          branchName={pulse.currentBranch?.name ?? null}
          latestVersionId={pulse.latestVersion?.id ?? null}
          latestVersionNumber={pulse.latestVersion?.number ?? null}
          latestVersionLabel={pulse.latestVersion?.label ?? null}
          canComment={auth.membership.canComment}
          canApproveVersions={auth.membership.canApproveVersions}
          canViewFiles={auth.membership.canViewFiles}
        />
      ) : null}
      <PulseTiles
        pulse={pulse}
        slug={slug}
        requirements={activeRequirements}
        watcherCount={devices.length}
        versionCount={versions.length}
        fileCount={files.items.length}
        rightColumnSlot={
          <AiNarrativeTile
            projectId={project.id}
            defaultSummary={defaultSummary}
          />
        }
      />
      <DesignerCollaborationHub
        projectId={project.id}
        projectSlug={slug}
        files={files.items.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          path: f.path,
          kind: f.kind,
          extension: f.extension,
          sizeBytes: f.sizeBytes.toString(),
          createdAt: f.createdAt.toISOString(),
          linkedRequirementCount: f.linkedRequirementCount,
        }))}
        initialComments={projectComments.map((c) => ({
          id: c.id,
          body: c.body,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          convertedTaskId: c.convertedTaskId,
          fileId: c.fileId,
          versionId: c.versionId,
          anchorJson:
            (c.anchorJson as { x?: number; y?: number } | null) ?? null,
          author: c.author ?? null,
          file: c.file
            ? { id: c.file.id, fileName: c.file.fileName, path: c.file.path }
            : null,
          version: c.version ?? null,
        }))}
        initialProposals={pendingProposals}
        initialRequests={pendingAccessRequests}
        isClient={isClient}
        canViewFiles={auth.membership.canViewFiles}
        canDownloadFiles={auth.membership.canDownloadFiles}
        canComment={auth.membership.canComment}
      />
      {!isClient ? <GettingStarted steps={steps} /> : null}
      <ActivityFeed items={activity.items} />
    </div>
  );
}
