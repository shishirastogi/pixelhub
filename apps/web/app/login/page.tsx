import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { PixelHubLogo } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/app");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/70 bg-[#F8F6F1] p-3 shadow-shell lg:grid-cols-12">
        {/* Left Golden Editorial Panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden rounded-[24px] bg-golden-hero p-8 lg:col-span-5 lg:flex">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#141413] text-xs text-white">
              ✦
            </span>
            <span className="text-xs font-medium text-[#141413]">
              Creative Version Control
            </span>
          </div>
          <div>
            <h2 className="font-serif text-4xl leading-[1.06] text-[#141413]">
              Explore your
              <br />
              <span className="italic">performance</span>
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-[#423E37]">
              Sign in to track deliverables, review snapshots, and keep client
              exports in lockstep with your local design folder.
            </p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex flex-col justify-center rounded-[24px] bg-white p-7 sm:p-10 lg:col-span-7">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/">
              <PixelHubLogo />
            </Link>
            <span className="rounded-full bg-[#9FE830] px-2.5 py-0.5 text-[11px] font-semibold text-[#141413]">
              Demo Ready
            </span>
          </div>
          <h1 className="font-serif text-3xl text-[#141413]">
            Welcome back to PixelHub
          </h1>
          <p className="mb-6 mt-1 text-xs text-[#6B6860]">
            Demo credentials are pre-filled so you can explore right away.
          </p>
          <AuthForm mode="login" />
        </div>
      </div>
    </main>
  );
}
