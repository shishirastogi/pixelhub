import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { Badge, Card, CardTitle, PixelHubLogo } from "@/components/ui";
import { AccountSettingsForm } from "@/components/user-profile-modal";
import { requireCurrentUser } from "@/server/auth/session";
import { listProjects } from "@/server/modules/projects/service";

export const metadata: Metadata = { title: "Account Settings · PixelHub" };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await requireCurrentUser();
  const projects = await listProjects(user.id);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/app">
            <PixelHubLogo size="lg" />
          </Link>
          <div className="flex items-center gap-2.5">
            <Link
              href="/app"
              className="rounded-full border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] shadow-pill transition hover:bg-[#F3F1EC]"
            >
              ← Back to {user.accountType === "CLIENT" ? "Client Portal" : "Studio"}
            </Link>
            <LogoutButton />
          </div>
        </header>

        <Card className="p-6 sm:p-8">
          <CardTitle
            hint={
              <Badge tone={user.accountType === "CLIENT" ? "info" : "lime"}>
                {user.accountType} ACCOUNT
              </Badge>
            }
          >
            Account Settings & Security
          </CardTitle>
          <AccountSettingsForm
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              accountType: user.accountType,
              company: user.company,
              title: user.title,
            }}
          />
        </Card>

        <Card className="p-6 sm:p-8">
          <CardTitle
            hint={<Badge tone="neutral">{projects.length} projects</Badge>}
          >
            Your Project Access & Permissions
          </CardTitle>
          {projects.length === 0 ? (
            <p className="text-xs text-[#6B6860]">
              You do not currently belong to any projects.
            </p>
          ) : (
            <div className="divide-y divide-[#F4F2ED]">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                >
                  <div>
                    <Link
                      href={`/p/${p.slug}`}
                      className="font-semibold text-[#141413] hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-[#6B6860]">
                      Slug: <code className="font-mono">{p.slug}</code> ·{" "}
                      {p.clientName ?? "Internal"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={p.role === "OWNER" ? "lime" : "info"}>
                      {p.role}
                    </Badge>
                    {p.permissions.canViewFiles ? (
                      <Badge tone="neutral">Files</Badge>
                    ) : null}
                    {p.permissions.canDownloadFiles ? (
                      <Badge tone="neutral">Download</Badge>
                    ) : null}
                    {p.permissions.canComment ? (
                      <Badge tone="neutral">Reviews</Badge>
                    ) : null}
                    {p.permissions.canApproveVersions ? (
                      <Badge tone="neutral">Approve</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
