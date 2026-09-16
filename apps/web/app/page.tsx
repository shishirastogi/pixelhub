import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
        GitHub + Notion + Figma project management + AI QA
      </span>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        A version-controlled creative workspace for designers.
      </h1>
      <p className="max-w-xl text-neutral-600">
        Drop files into your project folder and PixelHub tracks deliverables,
        versions, brand consistency, and requirements automatically — then tells
        you what needs attention.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium transition hover:bg-neutral-100"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
