"use client";

import { useState } from "react";
import type {
  AnalyticsMetrics,
  RequirementTrendPoint,
} from "@pixelhub/types/contracts/analytics";
import { apiFetch } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import {
  Badge,
  Card,
  CardTitle,
  ProgressBar,
  SegmentedProgress,
} from "@/components/ui";
import { Button, ErrorText } from "@/components/form";

export default function AnalyticsTab({
  projectId,
  initialMetrics,
  initialTrend,
}: {
  projectId: string;
  initialMetrics: AnalyticsMetrics;
  initialTrend: RequirementTrendPoint[];
}) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(initialMetrics);
  const [trend, setTrend] = useState<RequirementTrendPoint[]>(initialTrend);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function handleRecompute() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const snapshot = await apiFetch<{ metrics: AnalyticsMetrics }>(
        `/projects/${projectId}/analytics/recompute`,
        { method: "POST" },
      );
      if (snapshot?.metrics) {
        setMetrics(snapshot.metrics);
      }
      const reqAnalytics = await apiFetch<{ trend: RequirementTrendPoint[] }>(
        `/projects/${projectId}/analytics/requirements`,
      );
      if (reqAnalytics?.trend) {
        setTrend(reqAnalytics.trend);
      }
      setNote("Analytics snapshot recomputed and saved for today.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to recompute analytics",
      );
    } finally {
      setBusy(false);
    }
  }

  const { versions, requirements, files, collaboration, design, ai } = metrics;
  const deliverableRatio =
    files.required > 0
      ? Math.round((files.produced / files.required) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {note ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
          {note}
        </p>
      ) : null}

      {/* Top Row: Requirement Coverage & Deliverable Velocity */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardTitle
            hint={
              <Button
                size="sm"
                onClick={() => void handleRecompute()}
                disabled={busy}
              >
                {busy ? "Recomputing…" : "↻ Recompute Snapshot"}
              </Button>
            }
          >
            Requirement & Deliverable Velocity
          </CardTitle>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold tracking-tight text-[#141413]">
              {requirements.coveragePct}% Coverage
            </span>
            <Badge tone="lime">
              {requirements.fulfilled}/{requirements.accepted} Fulfilled
            </Badge>
            <span className="text-xs text-[#6B6860]">
              Avg {requirements.avgRevisions} file links/spec ·{" "}
              {requirements.overdue} overdue
            </span>
          </div>

          <div className="mt-4">
            <SegmentedProgress value={requirements.coveragePct} segments={32} />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-[#FAF8F4] p-4 text-xs">
            <div>
              <p className="text-[#6B6860]">Deliverables Produced</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {files.produced}/{files.required}
              </p>
              <p className="text-[11px] text-[#6D28D9]">
                {deliverableRatio}% matched
              </p>
            </div>
            <div>
              <p className="text-[#6B6860]">Version Snapshots</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {versions.totalVersions}
              </p>
              <p className="text-[11px] text-[#6B6860]">
                across {versions.branchCount} active branch
                {versions.branchCount === 1 ? "" : "es"}
              </p>
            </div>
            <div>
              <p className="text-[#6B6860]">Adoptions (7d)</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {versions.mergesLast7d}
              </p>
              <p className="text-[11px] text-[#6B6860]">
                {versions.avgIntervalDays !== null
                  ? `every ${versions.avgIntervalDays}d avg`
                  : "milestone cadence"}
              </p>
            </div>
          </div>

          {trend.length > 0 ? (
            <div className="mt-4 border-t border-[#F2EFE8] pt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#6B6860]">
                Recorded Snapshot History ({trend.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {trend.map((pt) => (
                  <span
                    key={pt.date}
                    className="rounded-xl border border-[#EBE7DF] bg-white px-2.5 py-1 text-xs"
                  >
                    <span className="font-mono text-[#6B6860]">{pt.date}</span>:{" "}
                    <span className="font-semibold text-[#6D28D9]">
                      {pt.coveragePct}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {/* Branch Activity Breakdown */}
        <Card className="lg:col-span-5">
          <CardTitle
            hint={<Badge tone="violet">{versions.perBranch.length} branches</Badge>}
          >
            Snapshots by Branch
          </CardTitle>

          <div className="space-y-3">
            {versions.perBranch.map((b) => {
              const pct =
                versions.totalVersions > 0
                  ? Math.round((b.versions / versions.totalVersions) * 100)
                  : 0;
              return (
                <div
                  key={b.branchId}
                  className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3.5"
                >
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#141413]">
                      {b.name}
                    </span>
                    <span className="font-mono text-[#6D28D9]">
                      {b.versions} version{b.versions === 1 ? "" : "s"} ({pct}%)
                    </span>
                  </div>
                  <ProgressBar value={pct} tone="violet" />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Bottom Row: File & Storage Telemetry + Collaboration & AI */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardTitle
            hint={<Badge tone="neutral">{files.total} total files</Badge>}
          >
            Storage & Asset Distribution
          </CardTitle>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">Content Dedupe</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {files.duplicates}
              </p>
              <p className="text-[11px] text-[#6B6860]">shared SHA-256 blobs</p>
            </div>
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">Superseded</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {files.outdatedCount}
              </p>
              <p className="text-[11px] text-[#6B6860]">prior revisions</p>
            </div>
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">File Formats</p>
              <p className="mt-1 text-xl font-bold text-[#6D28D9]">
                {Object.keys(files.typeDistribution).length}
              </p>
              <p className="text-[11px] text-[#6B6860]">extensions</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#6B6860]">
              Storage by Asset Kind
            </p>
            {files.storageByKind.length === 0 ? (
              <p className="text-xs text-[#6B6860]">No files stored yet.</p>
            ) : (
              <div className="divide-y divide-[#F4F2ED] rounded-2xl border border-[#EBE7DF] bg-white px-3.5">
                {files.storageByKind.map((item) => (
                  <div
                    key={item.kind}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <Badge tone="neutral">{item.kind}</Badge>
                    <span className="font-mono font-medium text-[#141413]">
                      {formatBytes(item.bytes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-6">
          <CardTitle>Collaboration, Diffs & AI Telemetry</CardTitle>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">Contributors (30d)</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {collaboration.activeContributors}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">Review Comments</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {collaboration.comments}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">Review Turnaround</p>
              <p className="mt-1 text-xl font-bold text-[#6D28D9]">
                {collaboration.avgReviewTurnaroundH !== null
                  ? `${collaboration.avgReviewTurnaroundH}h`
                  : "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">Color / Font Diffs</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {design.colorChangeCount + design.fontChangeCount}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">AI Jobs Executed</p>
              <p className="mt-1 text-xl font-bold text-[#141413]">
                {ai.jobsRun}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="text-[#6B6860]">Est. AI Spend</p>
              <p className="mt-1 text-xl font-bold text-[#15803D]">
                ${ai.estCostUsd.toFixed(4)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
