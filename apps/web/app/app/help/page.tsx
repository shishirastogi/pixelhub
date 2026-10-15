import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { PixelHubLogo } from "@/components/ui";
import { HelpCenterView } from "@/components/help/HelpCenterView";
import { requireCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Help & FAQ · PixelHub" };
export const dynamic = "force-dynamic";

export default async function StudioHelpPage() {
  const user = await requireCurrentUser();

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/app">
            <PixelHubLogo size="lg" />
          </Link>
          <div className="flex items-center gap-2.5">
            <Link
              href="/app"
              className="rounded-full border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] shadow-pill transition hover:bg-[#F3F1EC]"
            >
              ← Back to{" "}
              {user.accountType === "CLIENT" ? "Client Portal" : "Studio"}
            </Link>
            <LogoutButton />
          </div>
        </header>

        <HelpCenterView
          userAccountType={user.accountType}
          userName={user.name}
        />
      </div>
    </main>
  );
}
