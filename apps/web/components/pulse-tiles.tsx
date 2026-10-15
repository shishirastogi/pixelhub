"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Card,
  CardTitle,
  ProgressBar,
  SegmentedProgress,
} from "@/components/ui";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type Severity = "INFO" | "WARNING" | "ERROR";

export interface PulseRequirementRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  quantity: number;
  dueDate: string | Date | null;
  coverage: { satisfied: number; total: number };
  patternHint: string;
}

export interface PulseData {
  deliverables: { done: number; total: number };
  requirementCoveragePct: number;
  fulfilledRequirements: number;
  acceptedRequirements: number;
  openTasks: number;
  currentBranch: { id: string; name: string; kind: string } | null;
  latestVersion: {
    id: string;
    number: number;
    label: string | null;
    createdAt: string | Date;
  } | null;
  attentionItems: Array<{
    type: string;
    severity: Severity;
    title: string;
    message: string;
    entityType: string;
    entityId: string;
  }>;
}

const SEVERITY_TONE: Record<Severity, "info" | "warning" | "danger"> = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "danger",
};

const BAR_HEIGHTS = [
  38, 52, 44, 61, 48, 35, 58, 67, 54, 42, 49, 63, 72, 55, 46, 39, 51, 64, 82,
  74, 88, 69, 94, 79, 85, 62, 57, 48, 63, 71, 58, 52, 66, 60, 54, 62,
];

export function PulseTiles({
  pulse,
  slug,
  requirements = [],
  watcherCount = 0,
  versionCount = 0,
  fileCount = 0,
   rightColumnSlot,
}: {
  pulse: PulseData;
  slug?: string;
  requirements?: PulseRequirementRow[];
  watcherCount?: number;
  versionCount?: number;
  fileCount?: number;
  rightColumnSlot?: React.ReactNode;
}) {
  const { done, total } = pulse.deliverables;
  const deliverablePct = total > 0 ? Math.round((done / total) * 100) : 0;
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FULFILLED" | "OPEN">(
    "ALL",
  );
  const [chartMode, setChartMode] = useState<"COVERAGE" | "DELIVERABLES">(
    "COVERAGE",
  );

  const filteredRequirements = requirements
    .filter((req) => {
      if (statusFilter === "FULFILLED") {
        return (
          req.status === "FULFILLED" ||
          (req.coverage.total > 0 &&
            req.coverage.satisfied >= req.coverage.total)
        );
      }
      if (statusFilter === "OPEN") {
        return req.status !== "FULFILLED";
      }
      return true;
    })
    .sort((a, b) => {
      const aRatio =
        a.coverage.total > 0 ? a.coverage.satisfied / a.coverage.total : 0;
      const bRatio =
        b.coverage.total > 0 ? b.coverage.satisfied / b.coverage.total : 0;
      return sortAsc ? aRatio - bRatio : bRatio - aRatio;
    });

  const baseHref = slug ? `/p/${slug}` : "#";
  const branchHealthPct =
    pulse.acceptedRequirements > 0
      ? Math.round(
          (pulse.fulfilledRequirements / pulse.acceptedRequirements) * 100,
        )
      : deliverablePct;

  return (
    <div className="space-y-5">
      {/* TOP BENTO ROW: Golden Abstract Hero Card + RevenueX-Style Trend Card */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Warm Golden Abstract Hero Card */}
        <div className="relative flex min-h-[290px] flex-col justify-between overflow-hidden rounded-[26px] bg-golden-hero p-6 shadow-card sm:p-7 lg:col-span-5">
          {/* Decorative 3D silk wave rings */}
          <svg
            viewBox="0 0 360 360"
            fill="none"
            className="pointer-events-none absolute -right-14 -top-10 h-72 w-72 opacity-75"
          >
            <path
              d="M240 -20C310 40 340 160 270 260C200 360 110 340 160 220C210 100 170 -80 240 -20Z"
              fill="url(#goldWave)"
              fillOpacity="0.55"
            />
            <circle
              cx="245"
              cy="135"
              r="118"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="26"
            />
            <defs>
              <linearGradient
                id="goldWave"
                x1="140"
                y1="0"
                x2="320"
                y2="320"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#E5A229" />
                <stop offset="0.5" stopColor="#FCE694" />
                <stop offset="1" stopColor="#D98B19" />
              </linearGradient>
            </defs>
          </svg>

          {/* Top Live Data Badge Cluster */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#141413] text-white shadow-sm">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path
                      d="M2.5 10.5 5.5 7.5l2.5 2 5.5-5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-[#141413] text-white shadow-sm">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path
                      d="M4 12V7.5M8 12V4M12 12V6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
              <span className="text-xs font-medium text-[#141413]">
                {watcherCount > 0
                  ? `Watcher · ${watcherCount} live device${watcherCount === 1 ? "" : "s"}`
                  : "Analytics · Live data"}
              </span>
            </div>
            {pulse.currentBranch ? (
              <span className="rounded-full bg-white/75 px-3 py-1 text-[11px] font-medium text-[#141413] backdrop-blur">
                {pulse.currentBranch.name}
              </span>
            ) : null}
          </div>

          {/* Bottom Editorial Headline */}
          <div className="relative z-10 mt-10">
            <h2 className="font-serif text-[44px] font-normal leading-[1.02] tracking-[-0.02em] text-[#141413] sm:text-[50px]">
              Explore your
              <br />
              <span className="italic">performance</span>
            </h2>
            <p className="mt-2.5 text-xs text-[#423E37]">
              Dive into deliverable trends, version snapshots, and brand QA
              insights
            </p>
            {slug ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`${baseHref}/brief`}
                  className="rounded-full bg-[#141413] px-3.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#2A2927]"
                >
                  Open Brief & Specs →
                </Link>
                <Link
                  href={`${baseHref}/versions`}
                  className="rounded-full bg-white/80 px-3.5 py-1.5 text-[11px] font-medium text-[#141413] backdrop-blur transition hover:bg-white"
                >
                  {pulse.latestVersion
                    ? `Latest: v${pulse.latestVersion.number}`
                    : "Snapshot Version"}
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Deliverable & Velocity Trends Card (Revenue Trends style) */}
        <Card className="flex flex-col justify-between lg:col-span-7">
          <div>
            <CardTitle
              hint={
                <button
                  type="button"
                  onClick={() =>
                    setChartMode((prev) =>
                      prev === "COVERAGE" ? "DELIVERABLES" : "COVERAGE",
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#EBE7DF] bg-[#FAF8F4] px-3.5 py-1.5 text-xs font-medium text-[#141413] transition hover:bg-[#F3F1EC]"
                >
                  <span>
                    {chartMode === "COVERAGE" ? "Filter" : "Deliverables"}
                  </span>
                  <svg
                    viewBox="0 0 14 14"
                    fill="none"
                    className="h-3 w-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M2 4h10M4 7h6M6 10h2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              }
            >
              Deliverable & Velocity Trends
            </CardTitle>

            {/* Primary Metric + Neon Lime Pill */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-3xl font-bold tracking-tight text-[#141413]">
                {chartMode === "COVERAGE"
                  ? `${done}/${total} Matched`
                  : `${pulse.requirementCoveragePct}% Coverage`}
              </span>
              <span className="inline-flex items-center rounded-full bg-[#9FE830] px-2.5 py-0.5 text-xs font-semibold text-[#141413]">
                + {deliverablePct}%
              </span>
              <span className="text-xs text-[#6B6860]">
                {pulse.fulfilledRequirements}/{pulse.acceptedRequirements}{" "}
                requirements fulfilled · {fileCount} files tracked
              </span>
            </div>
          </div>

          {/* Interactive Impulse + Purple Spline Chart */}
          <div className="relative mt-5 pt-2">
            <div className="grid grid-cols-[32px_1fr] gap-2">
              {/* Y-Axis Labels */}
              <div className="flex h-36 flex-col justify-between text-[11px] text-[#9A968C]">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>

              {/* Plot Area */}
              <div className="relative h-36">
                {/* Vertical Impulse Bars */}
                <div className="absolute inset-0 flex items-end justify-between gap-[3px] px-1">
                  {BAR_HEIGHTS.map((h, i) => {
                    const isHighlighted = i >= 17 && i <= 25;
                    return (
                      <div
                        key={i}
                        className="flex h-full flex-1 flex-col justify-end"
                      >
                        <span
                          className={cn(
                            "w-full rounded-full transition-all duration-300",
                            isHighlighted
                              ? "bg-gradient-to-t from-[#7C3AED]/85 to-[#A855F7]"
                              : "bg-[#EAE6DD]",
                          )}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Smooth Purple Cubic Bezier Curve Overlay */}
                <svg
                  viewBox="0 0 500 140"
                  fill="none"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <path
                    d="M 0 72 C 35 60, 55 88, 85 82 C 115 76, 130 34, 165 44 C 200 54, 225 65, 260 58 C 295 50, 315 35, 345 78 C 375 115, 400 50, 435 62 C 465 72, 480 48, 500 56"
                    stroke="#7C3AED"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="345"
                    cy="78"
                    r="4.5"
                    fill="#7C3AED"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </svg>

                {/* Floating Callout Tooltip Card */}
                <div className="absolute bottom-4 left-[54%] z-10 -translate-x-1/2 rounded-2xl border border-[#EBE7DF] bg-white px-3.5 py-2 shadow-float sm:left-[62%]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#141413]">
                      {pulse.latestVersion
                        ? `v${pulse.latestVersion.number}`
                        : `${done}/${total}`}
                    </span>
                    <span className="rounded-full bg-[#9FE830] px-2 py-0.5 text-[10px] font-semibold text-[#141413]">
                      + {deliverablePct}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6B6860]">
                    {pulse.latestVersion
                      ? timeAgo(pulse.latestVersion.createdAt)
                      : `${versionCount} snapshots`}
                  </p>
                </div>
              </div>
            </div>

            {/* X-Axis Labels */}
            <div className="mt-2 flex justify-between pl-10 pr-2 text-[11px] text-[#9A968C]">
              <span>Brief</span>
              <span>Concept</span>
              <span>Revision</span>
              <span>Exports</span>
              <span>Brand QA</span>
              <span>Main</span>
            </div>
          </div>
        </Card>
      </div>

      {/* BOTTOM BENTO ROW: Deliverable Performance Table (Left 7 cols) + Goal Progress & AI Assistant (Right 5 cols) */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Bottom-Left: Product/Deliverable Performance Table Card */}
        <Card className="lg:col-span-7">
          <CardTitle
            icon={
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="h-3.5 w-3.5"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path
                  d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"
                  strokeLinecap="round"
                />
              </svg>
            }
            hint={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSortAsc((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#EBE7DF] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium text-[#141413] transition hover:bg-[#F3F1EC]"
                >
                  <span>Sort</span>
                  <span>{sortAsc ? "↑" : "↓"}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === "ALL"
                        ? "FULFILLED"
                        : prev === "FULFILLED"
                          ? "OPEN"
                          : "ALL",
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-[#EBE7DF] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium text-[#141413] transition hover:bg-[#F3F1EC]"
                >
                  <span>
                    {statusFilter === "ALL"
                      ? "Filter"
                      : statusFilter === "FULFILLED"
                        ? "Fulfilled"
                        : "Open"}
                  </span>
                  <svg
                    viewBox="0 0 14 14"
                    fill="none"
                    className="h-3 w-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M2 4h10M4 7h6M6 10h2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            }
          >
            Deliverable Performance
          </CardTitle>

          {/* Table Column Header Bar */}
          <div className="grid grid-cols-12 items-center rounded-xl bg-[#F4F2ED] px-3.5 py-2.5 text-xs font-medium text-[#57544E]">
            <div className="col-span-6 flex items-center gap-2.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#141413] text-[10px] text-white">
                −
              </span>
              <span>Deliverable</span>
            </div>
            <div className="col-span-2">Total Matched</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Priority</div>
          </div>

          {/* Rows */}
          {filteredRequirements.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-[#DFD9CC] bg-[#FAF8F4] p-6 text-center">
              <p className="font-serif text-lg text-[#141413]">
                {requirements.length === 0
                  ? "No deliverable specs tracked yet"
                  : "No deliverables match this filter"}
              </p>
              <p className="mt-1 text-xs text-[#6B6860]">
                {requirements.length === 0
                  ? "Add requirements with file patterns (e.g. instagram_post_*.png) on the Brief tab so exports auto-satisfy them."
                  : "Click Filter above to show all deliverables."}
              </p>
              {slug && requirements.length === 0 ? (
                <Link
                  href={`${baseHref}/brief`}
                  className="mt-3 inline-flex rounded-full bg-[#141413] px-4 py-2 text-xs font-medium text-white"
                >
                  + Add Requirements
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 divide-y divide-[#F4F2ED]">
              {filteredRequirements.map((req, idx) => {
                const isFulfilled =
                  req.status === "FULFILLED" ||
                  (req.coverage.total > 0 &&
                    req.coverage.satisfied >= req.coverage.total);
                return (
                  <div
                    key={req.id}
                    className="grid grid-cols-12 items-center gap-2 py-3 text-xs transition hover:bg-[#FAF8F4] px-2 rounded-xl"
                  >
                    <div className="col-span-6 flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                          isFulfilled
                            ? "bg-[#9FE830] text-[#141413]"
                            : "bg-[#F3F1EC] text-[#9A968C]",
                        )}
                      >
                        {isFulfilled ? "✓" : "−"}
                      </span>
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                          idx % 3 === 0
                            ? "bg-[#141413]"
                            : idx % 3 === 1
                              ? "bg-gradient-to-br from-[#312E81] to-[#1E1B4B]"
                              : "bg-gradient-to-br from-[#3F3F46] to-[#18181B]",
                        )}
                      >
                        <svg
                          viewBox="0 0 18 18"
                          fill="none"
                          className="h-4 w-4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect
                            x="2.75"
                            y="2.75"
                            width="12.5"
                            height="12.5"
                            rx="2.25"
                          />
                          <circle cx="6.5" cy="6.5" r="1.25" />
                          <path
                            d="m3.5 13 3.8-3.8 2.4 2.4 2.8-2.8 2 2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#141413]">
                          {req.title}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[#9A968C]">
                          {req.patternHint}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-2 font-medium text-[#141413]">
                      {req.coverage.satisfied}/{req.coverage.total} units
                    </div>

                    <div className="col-span-2">
                      <Badge tone={isFulfilled ? "success" : "info"}>
                        {isFulfilled ? "Available" : "In Stock"}
                      </Badge>
                    </div>

                    <div className="col-span-2 text-right font-semibold text-[#141413]">
                      {req.dueDate
                        ? formatDate(req.dueDate)
                        : req.priority}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Bottom-Right: Goal Progress Card + AI Assistant Slot */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* Goal Progress Card with Segmented Purple Meter */}
          <Card>
            <CardTitle
              icon={
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path
                    d="M3 4.5h10M3 8h7M3 11.5h10"
                    strokeLinecap="round"
                  />
                </svg>
              }
            >
              Goal Progress
            </CardTitle>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-[#6D28D9]">
                  {pulse.requirementCoveragePct}%
                </span>
                <span className="text-xs text-[#6B6860]">
                  of target reached
                </span>
              </div>
              <div className="min-w-[140px] flex-1">
                <SegmentedProgress
                  value={pulse.requirementCoveragePct}
                  segments={26}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#F2EFE8] pt-4">
              <div>
                <div className="mb-1.5 flex items-baseline gap-1.5">
                  <span className="text-base font-bold text-[#6D28D9]">
                    {deliverablePct}%
                  </span>
                  <span className="text-xs text-[#6B6860]">of deliverables</span>
                </div>
                <ProgressBar value={deliverablePct} tone="violet" />
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline gap-1.5">
                  <span className="text-base font-bold text-[#6D28D9]">
                    {branchHealthPct}%
                  </span>
                  <span className="text-xs text-[#6B6860]">of specs met</span>
                </div>
                <ProgressBar value={branchHealthPct} tone="violet" />
              </div>
            </div>
          </Card>

          {/* AI Analytics Assistant Slot */}
          {rightColumnSlot}
        </div>
      </div>

      {/* Needs Attention Strip (when items exist or summary bar) */}
      <Card>
        <CardTitle
          hint={
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{pulse.openTasks} open tasks</Badge>
              <Badge
                tone={pulse.attentionItems.length > 0 ? "warning" : "lime"}
              >
                {pulse.attentionItems.length} alert
                {pulse.attentionItems.length === 1 ? "" : "s"}
              </Badge>
            </div>
          }
        >
          Needs Attention
        </CardTitle>
        {pulse.attentionItems.length === 0 ? (
          <p className="text-xs text-[#6B6860]">
            Nothing needs attention right now — all deliverables and brand
            checks are in good standing.
          </p>
        ) : (
          <ul className="divide-y divide-[#F2EFE8]">
            {pulse.attentionItems.map((item, index) => (
              <li
                key={`${item.entityId}-${index}`}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold text-[#141413]">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#6B6860]">{item.message}</p>
                </div>
                <Badge tone={SEVERITY_TONE[item.severity]}>
                  {item.severity}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
