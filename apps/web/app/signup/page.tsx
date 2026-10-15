import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { PixelHubLogo } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/app");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/70 bg-[#F8F6F1] p-3 shadow-shell lg:grid-cols-12">
        <div className="relative hidden flex-col justify-between overflow-hidden rounded-[24px] bg-golden-hero p-8 lg:col-span-5 lg:flex">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#141413] text-xs text-white">
              ✦
            </span>
            <span className="text-xs font-medium text-[#141413]">
              Design Intelligence
            </span>
          </div>
          <div>
            <h2 className="font-serif text-4xl leading-[1.06] text-[#141413]">
              Zero drift
              <br />
              <span className="italic">between files & briefs</span>
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-[#423E37]">
              Create your account to pair folders, snapshot versions, and run
              automated brand checks.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-[24px] bg-white p-7 sm:p-10 lg:col-span-7">
          <div className="mb-6">
            <Link href="/">
              <PixelHubLogo />
            </Link>
          </div>
          <h1 className="font-serif text-3xl text-[#141413]">
            Create your studio account
          </h1>
          <p className="mb-6 mt-1 text-xs text-[#6B6860]">
            Start organizing creative projects, deliverables, and versions.
          </p>
          <AuthForm mode="signup" />
        </div>
      </div>
    </main>
  );
}
