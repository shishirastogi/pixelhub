import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewProjectForm } from "@/components/new-project-form";
import { Card, PixelHubLogo } from "@/components/ui";
import { requireCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "New Project · PixelHub" };

export default async function NewProjectPage() {
  const user = await requireCurrentUser();
  if (user.accountType === "CLIENT") {
    redirect("/app");
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/app">
            <PixelHubLogo />
          </Link>
          <Link
            href="/app"
            className="rounded-full border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] shadow-pill transition hover:bg-[#F3F1EC]"
          >
            ← Back to Studio
          </Link>
        </div>

        <Card className="p-7 sm:p-9">
          <h1 className="font-serif text-3xl text-[#141413]">
            Create New Workspace
          </h1>
          <p className="mb-6 mt-1 text-xs text-[#6B6860]">
            Initializes a project with a “Main Concept” branch, optional
            Experimental fork, and an automated Brand Kit.
          </p>
          <NewProjectForm />
        </Card>
      </div>
    </main>
  );
}
