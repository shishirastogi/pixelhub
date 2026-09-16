import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { LogoutButton } from "@/components/logout-button";
import { requireCurrentUser } from "@/server/auth/session";
import { listProjects } from "@/server/modules/projects/service";
import { formatDate } from "@/lib/utils";

export default async function MyProjectsPage() {
  const user = await requireCurrentUser();
  const projects = await listProjects(user.id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Projects</h1>
          <p className="text-sm text-neutral-500">Signed in as {user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/new"
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
          >
            + New Project
          </Link>
          <LogoutButton />
        </div>
      </header>

      {projects.length === 0 ? (
        <Card className="text-center">
          <p className="text-neutral-600">No projects yet.</p>
          <Link
            href="/app/new"
            className="mt-3 inline-block text-sm font-medium text-rose-600"
          >
            Create your first project →
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/p/${project.slug}`}>
              <Card className="h-full transition hover:border-rose-300 hover:shadow-md">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="font-medium">{project.name}</h2>
                  <Badge tone="info">{project.role}</Badge>
                </div>
                <p className="text-sm text-neutral-500">
                  {project.clientName ?? "No client"}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-neutral-500">Deadline</dt>
                    <dd>{formatDate(project.deadline)}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Files</dt>
                    <dd>{project._count.files}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Requirements</dt>
                    <dd>{project._count.requirements}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Branch</dt>
                    <dd>{project.defaultBranch?.name ?? "—"}</dd>
                  </div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
