"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { Button } from "@/components/form";

export interface TutorialStep {
  id: string;
  tabBadge: string;
  title: string;
  subtitle: string;
  highlights: string[];
  proTip: string;
  previewBadges: string[];
}

const DESIGNER_STEPS: TutorialStep[] = [
  {
    id: "welcome-designer",
    tabBadge: "Studio Overview · /app",
    title: "Welcome to Your PixelHub Designer Studio",
    subtitle:
      "PixelHub is built around one core rule: project state is derived from your files, never maintained by hand.",
    highlights: [
      "Create workspaces with a Main Concept branch, Experimental fork, and Brand Kit automatically initialized.",
      "Review incoming Client Access Requests and configure granular permissions before granting access.",
      "Use Quick Search (⌘ + Space) from anywhere in a project to jump between files and views.",
    ],
    proTip:
      "Your Designer account type is permanent and unlocks full studio creation, watcher pairing, and team management.",
    previewBadges: ["Studio Portfolio", "+ New Project", "Invite Client"],
  },
  {
    id: "pulse-dashboard",
    tabBadge: "Main · Dashboard Tab",
    title: "Performance Overview & Live Project Pulse",
    subtitle:
      "See the real-time health of your project at a glance — deliverables, velocity, client feedback, and AI insights.",
    highlights: [
      "Deliverable & Velocity Trends tracks how many deliverables are matched against client requirements.",
      "Goal Progress displays segmented completion meters for requirements and deliverables.",
      "Client Feedback & File Reviews inbox lets you preview commented files, reply inline, resolve, or convert client notes into tasks.",
    ],
    proTip:
      "Click any artwork card in the Live Project Artworks showcase on the Dashboard to open the Visual Lightbox.",
    previewBadges: ["Deliverable Velocity", "Goal Progress", "AI Assistant"],
  },
  {
    id: "brief-requirements",
    tabBadge: "Main · Contracts & Brief Tab",
    title: "Client Brief, AI Proposals & Auto-Matched Deliverables",
    subtitle:
      "Turn raw client briefs into structured requirements with deterministic file-pattern tracking.",
    highlights: [
      "Paste the client brief and click 'Extract requirements' to generate PENDING AI requirement proposals you can Accept or Dismiss.",
      "Add deliverables with glob file patterns (e.g. instagram_post_*.{png,jpg} or banner_*.png).",
      "When a matching export is uploaded or synced by the watcher, the deliverable automatically flips to SATISFIED (✓).",
    ],
    proTip:
      "You can also click any deliverable's status badge to toggle it manually or click 'Generate tasks' for an AI checklist.",
    previewBadges: ["Extract Requirements", "instagram_post_*.png", "Auto-Matched"],
  },
  {
    id: "files-watcher",
    tabBadge: "Other · Files & Watcher Tab",
    title: "Visual Asset Gallery, Pinpoint Reviews & Folder Watcher",
    subtitle:
      "Browse content-addressed project files, drop spatial review pins on images, and pair your local folder.",
    highlights: [
      "Switch between Visual Gallery view (⊞) and Table view (☰), or drag-and-drop exports directly into exports/.",
      "Click any file to open the Interactive Lightbox — click anywhere on the artwork canvas to drop a numbered spatial pin.",
      "Click 'Pair this folder' to get an 8-character code for pixelhub-watch so local saves sync automatically.",
    ],
    proTip:
      "Files are SHA-256 hashed and deduplicated across branches and versions.",
    previewBadges: ["⊞ Visual Gallery", "📍 Spatial Pins", "pixelhub-watch"],
  },
  {
    id: "versions-compare",
    tabBadge: "Main · Versions & Compare Tabs",
    title: "Designer-Friendly Branches, Snapshots & Visual Diffs",
    subtitle:
      "Explore directions safely in Concept, Revision, or Experimental branches without rebase terror.",
    highlights: [
      "Click 'Snapshot current state' on the Versions tab to freeze an immutable checkpoint (v1, v2, v3…).",
      "Select any two versions and click 'Compare selected' to inspect Added/Removed/Modified files, dominant color shifts, and typography diffs.",
      "When a Concept or Revision branch is approved, click 'Adopt into Main' to choose which files land on Main.",
    ],
    proTip:
      "Each version detail panel also includes a dedicated Review Feedback thread where comments can be converted into tasks.",
    previewBadges: ["Concept Branch", "Snapshot v2", "Adopt into Main"],
  },
  {
    id: "brand-design-tasks",
    tabBadge: "Other · Brand Kit, Design Sheet & Tasks",
    title: "Automated CIE76 ΔE Brand QA, Moodboards & Tasks",
    subtitle:
      "Catch off-brand colors before the client sees them and keep every reference and task traceable.",
    highlights: [
      "Brand Performance: Define brand colors with ΔE tolerances, fonts, logos, and rules, then click 'Run brand check' to scan exports.",
      "Design Sheet: Collect moodboard images, color swatches, URLs, and notes grouped by board and linked to requirements.",
      "Tasks & QA: Manage To Do / In Progress / Done cards with interactive step-by-step checklists.",
    ],
    proTip:
      "Client comments on files or versions can be converted directly into Tasks with one click.",
    previewBadges: ["ΔE Color Check", "Design Sheet", "Interactive Checklists"],
  },
  {
    id: "client-permissions-help",
    tabBadge: "Account · Team, Settings & Help",
    title: "Client Permissions, Decision Log & 24/7 Help Chatbot",
    subtitle:
      "Control exactly what each client can see and do, record key decisions, and get instant help anytime.",
    highlights: [
      "Open 'Team & Permissions' in the sidebar (or top member bar) to invite clients and toggle 5 granular permissions live.",
      "Use the 'Decision Log' tab to document approved creative directions and their rationale.",
      "Open 'Help & FAQ' anytime to chat with the AI Workspace Assistant or replay this interactive tour.",
    ],
    proTip:
      "You're all set! Click Finish below to start exploring your studio workspace.",
    previewBadges: ["5 Client Permissions", "Decision Log", "AI Help Chatbot"],
  },
];

const CLIENT_STEPS: TutorialStep[] = [
  {
    id: "welcome-client",
    tabBadge: "Client Portal · /app",
    title: "Welcome to Your PixelHub Client Review Portal",
    subtitle:
      "Track live deliverable progress, review visual artworks, and sign off on versions — all in one place.",
    highlights: [
      "Accept project invitations waiting for you at the top of your Client Dashboard.",
      "Need access to a studio workspace? Enter the exact Project Slug shared by your designer (e.g. acme-q4-campaign) to request access.",
      "Each project card clearly displays the permissions granted to you by the studio.",
    ],
    proTip:
      "Your Client account is tailored for streamlined reviewing and sign-off without complex studio clutter.",
    previewBadges: ["Accept Invitations", "Request by Slug", "Live Progress"],
  },
  {
    id: "client-progress",
    tabBadge: "Client Review · Project Progress Tab",
    title: "Real-Time Deliverable & Milestone Tracking",
    subtitle:
      "See exactly which deliverables are ready and how close the project is to completion.",
    highlights: [
      "Deliverable Performance shows every promised item and flips to 'Available' (✓) the moment the studio uploads the matching file.",
      "Goal Progress displays the overall percentage of your project brief that has been fulfilled.",
      "Use the Client Review & Sign-Off bar at the top of the dashboard to post quick feedback or approve the current direction.",
    ],
    proTip:
      "Progress is calculated automatically from real project files — so the numbers you see are always accurate.",
    previewBadges: ["Deliverable Table", "Goal Progress", "Client Sign-Off"],
  },
  {
    id: "client-visual-review",
    tabBadge: "Shared Assets · Shared Files Tab",
    title: "Visual Artwork Previews & Spatial Pinpoint Reviews",
    subtitle:
      "Inspect high-resolution deliverables and pin your feedback directly onto the artwork.",
    highlights: [
      "Click any deliverable card on the Dashboard or Shared Files gallery to open the Interactive Preview Lightbox.",
      "Click anywhere on the image canvas to drop a numbered spatial pin (1, 2, 3) at that exact spot and write your note.",
      "If the studio has enabled download permissions for your account, click 'Download Original File' to save the export.",
    ],
    proTip:
      "Your pinned comments appear immediately in the designer's review inbox so they can convert them into action items.",
    previewBadges: ["Visual Lightbox", "📍 Click Image to Pin", "Download Export"],
  },
  {
    id: "client-versions-decisions",
    tabBadge: "Client Review · Versions & Decision Log",
    title: "Version Snapshots, Comparisons & Direction Approval",
    subtitle:
      "Review milestone checkpoints (v1, v2, v3) and see what changed between rounds.",
    highlights: [
      "Open 'Versions & Reviews' to inspect every milestone snapshot, preview its pinned files, and read designer notes.",
      "Check any two versions and click 'Compare selected' to see added/updated files and color palette shifts.",
      "When you're happy with a round, click '✓ Approve Direction' to record your official sign-off.",
    ],
    proTip:
      "Check the 'Decision Log' tab to see the recorded rationale behind key design choices.",
    previewBadges: ["Snapshot Timeline", "Compare Rounds", "✓ Approve Direction"],
  },
  {
    id: "client-account-help",
    tabBadge: "Account · Settings & Help Chatbot",
    title: "Account Settings & 24/7 AI Help Assistant",
    subtitle:
      "Manage your profile details and ask the Help Chatbot anything about your project.",
    highlights: [
      "Click 'Account Settings' in the sidebar to update your Name, Email, Company, Job Title, or Password.",
      "Open the 'Help & FAQ' tab to browse categorized guides or ask the AI Chatbot live questions like 'Which deliverables are still open?'.",
      "You can replay this interactive tutorial anytime from the Help & FAQ tab.",
    ],
    proTip:
      "Click Finish below to jump into your Client Review Portal!",
    previewBadges: ["Account Settings", "Help & FAQ", "Live Project Q&A"],
  },
];

export function OnboardingTutorialModal({
  open,
  onClose,
  accountType,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  accountType: "DESIGNER" | "CLIENT";
  userName?: string;
}) {
  const steps = accountType === "CLIENT" ? CLIENT_STEPS : DESIGNER_STEPS;
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
      }
      if (e.key === "ArrowLeft") {
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, steps.length]);

  if (!open) return null;

  const current = steps[stepIndex] ?? steps[0]!;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-float"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Top Visual Banner */}
        <div
          className={cn(
            "relative overflow-hidden p-6 sm:p-7",
            accountType === "CLIENT" ? "bg-ai-sky" : "bg-golden-hero",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#141413] text-xs text-white">
                ✦
              </span>
              <Badge tone="dark">
                Step {stepIndex + 1} of {steps.length} ·{" "}
                {accountType === "CLIENT" ? "Client Guide" : "Designer Guide"}
              </Badge>
              <span className="rounded-full bg-white/80 px-3 py-0.5 text-xs font-medium text-[#141413]">
                {current.tabBadge}
              </span>
            </div>
          </div>

          <h2 className="mt-5 font-serif text-3xl leading-tight text-[#141413] sm:text-[34px]">
            {stepIndex === 0 && userName
              ? `${current.title}, ${userName.split(" ")[0]}!`
              : current.title}
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#423E37] sm:text-sm">
            {current.subtitle}
          </p>

          {/* Visual Feature Chips Preview */}
          <div className="mt-4 flex flex-wrap gap-2">
            {current.previewBadges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-semibold text-[#141413] shadow-pill"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* Step Body */}
        <div className="space-y-4 p-6 sm:p-7">
          {/* Segmented Step Progress Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndex(idx)}
                aria-label={`Go to step ${idx + 1}`}
                className={cn(
                  "h-2 flex-1 rounded-full transition-all",
                  idx === stepIndex
                    ? "bg-[#141413]"
                    : idx < stepIndex
                      ? "bg-[#9FE830]"
                      : "bg-[#EFECE6] hover:bg-[#DFD9CC]",
                )}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B6860]">
              How to Use This Feature
            </p>
            <ul className="space-y-2 text-xs leading-relaxed text-[#141413]">
              {current.highlights.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#9FE830] text-[10px] font-bold text-[#141413]">
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl border border-[#EBE7DF] bg-white px-4 py-3 text-xs text-[#57544E]">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#F3EEFF] font-bold text-[#6D28D9]">
              💡
            </span>
            <span>
              <strong className="text-[#141413]">Pro tip:</strong>{" "}
              {current.proTip}
            </span>
          </div>

          {/* Footer Navigation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F2EFE8] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-[#6B6860] underline hover:text-[#141413]"
            >
              Skip tutorial
            </button>

            <div className="flex items-center gap-2">
              {stepIndex > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                >
                  ← Previous
                </Button>
              ) : null}

              {isLast ? (
                <Button
                  variant="lime"
                  size="md"
                  onClick={onClose}
                >
                  Finish &amp; Start Exploring ✦
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() =>
                    setStepIndex((prev) =>
                      Math.min(steps.length - 1, prev + 1),
                    )
                  }
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
