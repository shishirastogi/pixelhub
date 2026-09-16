import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { ProjectTabs } from "@/components/project-tabs";
import { Badge } from "@/components/ui";
import { AppError } from "@/server/errors";
import { requireCurrentUser } from "@/server/auth/session";
import { listBranches } from "@/server/modules/branches/service";
import { getProject } from "@/server/modules/projects/service";
import { formatDate } from "@/lib/utils";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) {
  const user = await requireCurrentUser();

  let project;
  let branches;
  try {
    [project, branches] = await Promise.all([
      getProject(user.id, params.slug),
      listBranches(user.id, params.slug),
    ]);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.status === 404 || error.status === 403)
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/app"
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
            >
              ← All projects
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <Badge tone={project.status === "ACTIVE" ? "success" : "neutral"}>
                {project.status}
              </Badge>
            </div>
            <p className="text-sm text-neutral-500">
              {project.clientName ?? "No client"} · Deadline{" "}
              {formatDate(project.deadline)}
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Branches
          </span>
          {branches.map((branch) => {
            const active = branch.id === project.defaultBranchId;
            return (
              <span
                key={branch.id}
                className={
                  active
                    ? "rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700"
                    : "rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600"
                }
                title={branch.kind}
              >
                {branch.name}
                <span className="ml-1 text-neutral-400">
                  {branch.fileCount} files
                </span>
              </span>
            );
          })}
        </div>

        <ProjectTabs slug={project.slug} />
      </header>

      {children}
    </div>
  );
}
