"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { pollAiJob } from "@/lib/poll";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge, Card, CardTitle } from "@/components/ui";
import { Button, EmptyState, ErrorText } from "@/components/form";

export interface VersionOption {
  id: string;
  branchId: string;
  branchName: string;
  number: number;
  label: string | null;
  createdAt: string;
  fileCount: number;
}

interface VersionDiffJson {
  files: {
    added: Array<{ path: string; fileId: string }>;
    removed: Array<{ path: string }>;
    modified: Array<{ path: string; fromFileId: string; toFileId: string }>;
    renamed: Array<{ from: string; to: string; confidence: number }>;
  };
  colors: { dominantBefore: string[]; dominantAfter: string[] };
  typography: { detectedFontsBefore: string[]; detectedFontsAfter: string[] };
  counts: { filesBefore: number; filesAfter: number };
  ai?: {
    summary?: string;
    designerEnglish?: string;
    changes?: Array<{
      dimension?: string;
      finding?: string;
      impact?: string;
      title?: string;
      description?: string;
    }>;
  };
}

interface Comparison {
  id: string;
  baseVersionId: string;
  targetVersionId: string;
  jobId: string | null;
  diffJson: VersionDiffJson;
  summaryMd: string | null;
  createdAt: string;
}

interface ComparisonResponse {
  jobId?: string | null;
  comparisonId: string;
  comparison: Comparison;
}

type Tab = "FILES" | "COLORS" | "TYPOGRAPHY" | "SUMMARY";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "FILES", label: "Files" },
  { id: "COLORS", label: "Colors" },
  { id: "TYPOGRAPHY", label: "Typography" },
  { id: "SUMMARY", label: "Summary" },
];

function VersionSelect({
  value,
  onChange,
  versions,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  versions: VersionOption[];
  placeholder: string;
}) {
  const branches = new Map<
    string,
    { name: string; options: VersionOption[] }
  >();
  for (const version of versions) {
    const group = branches.get(version.branchId);
    if (group) group.options.push(version);
    else
      branches.set(version.branchId, {
        name: version.branchName,
        options: [version],
      });
  }

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-[#E6E1D6] bg-[#FCFBF9] px-3.5 py-2.5 text-sm text-[#141413] outline-none transition focus:border-[#7C3AED] focus:bg-white"
    >
      <option value="">{placeholder}</option>
      {Array.from(branches.entries()).map(([branchId, group]) => (
        <optgroup key={branchId} label={group.name}>
          {group.options.map((version) => (
            <option key={version.id} value={version.id}>
              v{version.number} — {version.label ?? "Untitled snapshot"}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function DiffSection({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "success" | "danger" | "warning" | "info";
  rows: string[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Badge tone={tone}>{title}</Badge>
        <span className="text-xs text-neutral-400">{rows.length}</span>
      </div>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li
            key={row}
            className="rounded-lg bg-neutral-50 px-3 py-1.5 font-mono text-xs text-neutral-700"
          >
            {row}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CompareView({
  versions,
  initialBaseId,
  initialTargetId,
}: {
  versions: VersionOption[];
  initialBaseId: string;
  initialTargetId: string;
}) {
  const [baseId, setBaseId] = useState(initialBaseId);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("FILES");
  const [aiState, setAiState] = useState<string | null>(null);
  const tokenRef = useRef(0);

  const runCompare = useCallback(async (base: string, target: string) => {
    if (!base || !target || base === target) {
      setError("Pick two different versions to compare.");
      return;
    }
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    setLoading(true);
    setError(null);
    setAiState(null);
    try {
      const res = await apiFetch<ComparisonResponse>("/versions/compare", {
        method: "POST",
        body: JSON.stringify({
          baseVersionId: base,
          targetVersionId: target,
        }),
      });
      if (tokenRef.current !== token) return;
      setComparison(res.comparison);

      const jobId = res.jobId ?? res.comparison.jobId;
      if (!res.comparison.summaryMd && jobId) {
        setAiState("AI summary is being generated…");
        void pollAiJob(jobId)
          .then(async (job) => {
            if (tokenRef.current !== token) return;
            if (job.status === "SUCCEEDED") {
              const fresh = await apiFetch<ComparisonResponse>(
                "/versions/compare",
                {
                  method: "POST",
                  body: JSON.stringify({
                    baseVersionId: base,
                    targetVersionId: target,
                  }),
                },
              );
              if (tokenRef.current !== token) return;
              setComparison(fresh.comparison);
              setAiState(null);
            } else {
              setAiState(
                job.error
                  ? `AI summary unavailable: ${job.error}`
                  : "AI summary unavailable.",
              );
            }
          })
          .catch(() => {
            if (tokenRef.current === token) {
              setAiState("AI summary unavailable.");
            }
          });
      }
    } catch (err) {
      if (tokenRef.current !== token) return;
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      if (tokenRef.current === token) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialBaseId && initialTargetId && initialBaseId !== initialTargetId) {
      void runCompare(initialBaseId, initialTargetId);
    }
  }, [initialBaseId, initialTargetId, runCompare]);

  const diff = comparison?.diffJson ?? null;
  const baseVersion = versions.find((version) => version.id === baseId);
  const targetVersion = versions.find((version) => version.id === targetId);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Compare versions</CardTitle>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">Base</p>
            <VersionSelect
              value={baseId}
              onChange={setBaseId}
              versions={versions}
              placeholder="Select base version…"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">Target</p>
            <VersionSelect
              value={targetId}
              onChange={setTargetId}
              versions={versions}
              placeholder="Select target version…"
            />
          </div>
          <div className="flex items-end">
            <Button
              disabled={loading || !baseId || !targetId || baseId === targetId}
              onClick={() => void runCompare(baseId, targetId)}
            >
              {loading ? "Comparing…" : "Compare"}
            </Button>
          </div>
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>
        ) : null}
      </Card>

      {comparison && diff ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-500">
              {baseVersion
                ? `v${baseVersion.number}${baseVersion.label ? ` (${baseVersion.label})` : ""}`
                : "base"}{" "}
              →{" "}
              {targetVersion
                ? `v${targetVersion.number}${targetVersion.label ? ` (${targetVersion.label})` : ""}`
                : "target"}{" "}
              · compared {formatDateTime(comparison.createdAt)}
            </p>
            {aiState ? (
              <p className="text-xs text-neutral-400">{aiState}</p>
            ) : null}
          </div>

          <div className="flex gap-1.5">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-medium transition",
                  tab === entry.id
                    ? "border-[#141413] bg-[#141413] text-white shadow-pill"
                    : "border-[#EBE7DF] bg-white text-[#6B6860] hover:bg-[#F3F1EC] hover:text-[#141413]",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <Card>
            {tab === "FILES" ? (
              <div className="space-y-5">
                <p className="text-sm text-neutral-500">
                  {diff.counts.filesBefore} files before ·{" "}
                  {diff.counts.filesAfter} after
                </p>
                <DiffSection
                  title="Added"
                  tone="success"
                  rows={diff.files.added.map((file) => file.path)}
                />
                <DiffSection
                  title="Removed"
                  tone="danger"
                  rows={diff.files.removed.map((file) => file.path)}
                />
                <DiffSection
                  title="Modified"
                  tone="warning"
                  rows={diff.files.modified.map((file) => file.path)}
                />
                <DiffSection
                  title="Renamed"
                  tone="info"
                  rows={diff.files.renamed.map(
                    (file) => `${file.from} → ${file.to}`,
                  )}
                />
                {diff.files.added.length === 0 &&
                diff.files.removed.length === 0 &&
                diff.files.modified.length === 0 &&
                diff.files.renamed.length === 0 ? (
                  <EmptyState
                    title="No file changes"
                    description="These two versions contain the same files."
                  />
                ) : null}
              </div>
            ) : tab === "COLORS" ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Base colors ({diff.colors.dominantBefore.length})
                  </p>
                  {diff.colors.dominantBefore.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No color data captured.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {diff.colors.dominantBefore.map((color) => (
                        <span
                          key={color}
                          className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                        >
                          <span
                            className="h-4 w-4 rounded border border-neutral-200"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-mono">{color}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Target colors ({diff.colors.dominantAfter.length})
                  </p>
                  {diff.colors.dominantAfter.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No color data captured.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {diff.colors.dominantAfter.map((color) => (
                        <span
                          key={color}
                          className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                        >
                          <span
                            className="h-4 w-4 rounded border border-neutral-200"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-mono">{color}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : tab === "TYPOGRAPHY" ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Base fonts
                  </p>
                  {diff.typography.detectedFontsBefore.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No font data captured.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {diff.typography.detectedFontsBefore.map((font) => (
                        <li
                          key={font}
                          className="rounded-lg bg-neutral-50 px-3 py-1.5 text-sm"
                        >
                          {font}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Target fonts
                  </p>
                  {diff.typography.detectedFontsAfter.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No font data captured.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {diff.typography.detectedFontsAfter.map((font) => (
                        <li
                          key={font}
                          className="rounded-lg bg-neutral-50 px-3 py-1.5 text-sm"
                        >
                          {font}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-neutral-400">
                  Designer-English explanation generated by AI.
                </p>
                {comparison.summaryMd ? (
                  <p className="whitespace-pre-wrap text-sm text-neutral-700">
                    {comparison.summaryMd}
                  </p>
                ) : aiState ? (
                  <p className="text-sm text-neutral-500">{aiState}</p>
                ) : (
                  <p className="text-sm text-neutral-500">
                    No AI summary for this comparison yet.
                  </p>
                )}
                {diff.ai?.changes && diff.ai.changes.length > 0 ? (
                  <ul className="space-y-2">
                    {diff.ai.changes.map((change, index) => (
                      <li
                        key={index}
                        className="rounded-xl border border-[#EBE7DF] bg-[#FAF8F4] px-3.5 py-2.5 text-xs"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          {change.dimension ? (
                            <Badge tone="violet">
                              {change.dimension.toUpperCase()}
                            </Badge>
                          ) : null}
                          {change.impact ? (
                            <Badge
                              tone={
                                change.impact === "high"
                                  ? "danger"
                                  : change.impact === "medium"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {change.impact} impact
                            </Badge>
                          ) : null}
                          {change.title ? (
                            <span className="font-semibold text-[#141413]">
                              {change.title}
                            </span>
                          ) : null}
                        </div>
                        {change.finding || change.description ? (
                          <p className="text-[#57544E]">
                            {change.finding ?? change.description}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            title="Pick two versions"
            description="Select a base and a target version above — or use the checkboxes on the Versions tab — to see what changed."
          />
        </Card>
      )}
    </div>
  );
}
