import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, PixelHubLogo, SegmentedProgress } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/session";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1420px] rounded-[34px] border border-white/70 bg-[#F8F6F1] p-5 shadow-shell sm:p-8 lg:p-10">
        {/* Top Navigation */}
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <PixelHubLogo size="lg" />
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="rounded-full border border-[#EBE7DF] bg-white px-5 py-2.5 text-xs font-medium text-[#141413] shadow-pill transition hover:bg-[#F3F1EC]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-[#141413] px-5 py-2.5 text-xs font-medium text-white shadow-pill transition hover:bg-[#2A2927]"
            >
              <span>Create Workspace</span>
              <span>↗</span>
            </Link>
          </div>
        </header>

        {/* Hero Bento Grid */}
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Golden Editorial Card */}
          <div className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[28px] bg-golden-hero p-7 shadow-card sm:p-9 lg:col-span-5">
            <svg
              viewBox="0 0 400 400"
              fill="none"
              className="pointer-events-none absolute -right-12 -top-12 h-80 w-80 opacity-60"
            >
              <circle
                cx="220"
                cy="180"
                r="140"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="36"
              />
              <circle
                cx="260"
                cy="240"
                r="110"
                stroke="rgba(217,145,22,0.28)"
                strokeWidth="28"
              />
            </svg>

            <div className="relative z-10 flex items-center gap-2">
              <div className="flex -space-x-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#141413] text-white">
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2.5 11.5 6 8l2.5 2.5L13.5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-[#141413] text-white">
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 12V7.5M8 12V4M12 12V6" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
              <span className="text-xs font-medium text-[#141413]">
                Live Watcher · Auto-Tracked Deliverables
              </span>
            </div>

            <div className="relative z-10 mt-12">
              <h1 className="font-serif text-5xl font-normal leading-[1.03] tracking-[-0.02em] text-[#141413] sm:text-6xl">
                Explore your
                <br />
                <span className="italic">creative pulse</span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#423E37]">
                Point PixelHub at your local design folder. Deliverables flip to
                fulfilled when exports land, versions snapshot like commits, and
                brand drift gets caught automatically.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-[#141413] px-6 py-3 text-xs font-medium text-white shadow-pill transition hover:bg-[#2A2927]"
                >
                  <span>Launch Studio Demo</span>
                  <span>→</span>
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-white/85 px-5 py-3 text-xs font-medium text-[#141413] shadow-pill backdrop-blur transition hover:bg-white"
                >
                  Create Free Account
                </Link>
              </div>
            </div>
          </div>

          {/* Right Preview Bento Column */}
          <div className="grid gap-5 lg:col-span-7">
            {/* Top Velocity Preview Card */}
            <div className="rounded-[28px] border border-[#EBE7DF] bg-white p-6 shadow-card sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F4F2ED] text-[#141413]">
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2.5 12.5V3.5M2.5 12.5H13.5M5 9.5 7.8 6.8l2.4 2.2 3-3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h2 className="font-serif text-xl text-[#141413]">
                    Deliverable Coverage & Velocity
                  </h2>
                </div>
                <Badge tone="neutral">Deterministic SHA-256 Sync</Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold tracking-tight text-[#141413]">
                  100% Traceable
                </span>
                <Badge tone="lime">+ 3/3 Matched</Badge>
                <span className="text-xs text-[#6B6860]">
                  instagram_post_*.png → auto-satisfied on save
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-[#FAF8F4] p-4">
                <div>
                  <p className="text-[11px] text-[#6B6860]">Folder Agent</p>
                  <p className="mt-0.5 font-serif text-xl text-[#141413]">
                    pixelhub-watch
                  </p>
                  <p className="text-[11px] text-[#15803D]">● Debounced sync</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#6B6860]">Version Graph</p>
                  <p className="mt-0.5 font-serif text-xl text-[#141413]">
                    Concept Branches
                  </p>
                  <p className="text-[11px] text-[#6D28D9]">● Adopt into Main</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#6B6860]">Brand QA</p>
                  <p className="mt-0.5 font-serif text-xl text-[#141413]">
                    ΔE Color & Fonts
                  </p>
                  <p className="text-[11px] text-[#141413]">● AI Proposals</p>
                </div>
              </div>
            </div>

            {/* Bottom 2-column Bento Preview */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-[28px] border border-[#EBE7DF] bg-white p-6 shadow-card">
                <h3 className="font-serif text-xl text-[#141413]">
                  Goal Progress
                </h3>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-3xl font-bold text-[#6D28D9]">94%</span>
                  <span className="text-xs text-[#6B6860]">
                    of brief fulfilled
                  </span>
                </div>
                <div className="mt-3">
                  <SegmentedProgress value={94} segments={24} />
                </div>
                <p className="mt-3 text-xs text-[#6B6860]">
                  Progress is derived directly from your watched files — never
                  maintained by hand.
                </p>
              </div>

              <div className="rounded-[28px] border border-sky-200/70 bg-ai-sky p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-xl text-[#141413]">
                    AI Creative Assistant
                  </h3>
                  <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-[#141413]">
                    Proposal Engine
                  </span>
                </div>
                <div className="mt-3 space-y-2 rounded-2xl border border-white/80 bg-white/65 p-3 backdrop-blur-md">
                  <div className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-[#141413] shadow-sm">
                    What changed between Concept v2 and v3?
                  </div>
                  <div className="rounded-xl bg-white/90 px-3 py-2 text-xs leading-relaxed text-[#57544E] shadow-sm">
                    3 Instagram exports added, hero palette shifted warmer within
                    ΔE 4.2 tolerance, all deliverables satisfied.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
