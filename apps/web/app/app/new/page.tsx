import type { Metadata } from "next";
import { NewProjectForm } from "@/components/new-project-form";
import { requireCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "New Project · PixelHub" };

export default async function NewProjectPage() {
  await requireCurrentUser();

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">New Project</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Creates a project with a “Main Concept” branch and an empty Brand Kit.
      </p>
      <NewProjectForm />
    </main>
  );
}
