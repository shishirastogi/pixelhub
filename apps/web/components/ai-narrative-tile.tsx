"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface NarrativeResult {
  narrative?: string;
  attentionItems?: Array<{ title: string; message: string; severity: string }>;
  suggestedNextActions?: string[];
}

interface AiJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  resultJson?: NarrativeResult | null;
  error?: string | null;
}

export function AiNarrativeTile({
  projectId,
  defaultSummary,
}: {
  projectId: string;
  defaultSummary?: string;
}) {
  const [job, setJob] = useState<AiJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const { jobId } = await apiFetch<{ jobId: string }>(
        `/projects/${projectId}/ai/status-narrative`,
        { method: "POST" },
      );

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const current = await apiFetch<AiJob>(`/ai-jobs/${jobId}`);
        setJob(current);
        if (
          current.status === "SUCCEEDED" ||
          current.status === "FAILED" ||
          current.status === "CANCELLED"
        ) {
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  const result = job?.resultJson ?? null;

  return (
    <div className="flex flex-1 flex-col justify-between rounded-[24px] border border-sky-200/80 bg-ai-sky p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-[#141413] shadow-sm">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path
                d="M2.5 12.5V3.5M2.5 12.5H13.5M5.5 9.5 8 7l2.2 2 2.8-3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h3 className="font-serif text-[21px] font-normal text-[#141413]">
            AI Analytics Assistant
          </h3>
        </div>

        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rounded-full border border-white/80 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-[#141413] shadow-pill transition hover:bg-white disabled:opacity-60"
        >
          {busy ? "Analyzing…" : "Ask Assistant"}
        </button>
      </div>

      {/* Frosted Glass Chat Container (RevenueX style) */}
      <div className="space-y-2.5 rounded-2xl border border-white/85 bg-white/60 p-3.5 backdrop-blur-md">
        <div className="w-fit rounded-xl bg-white px-3.5 py-2 text-xs font-medium text-[#141413] shadow-sm">
          What insights are you looking for?
        </div>

        <div className="rounded-xl bg-white/95 px-3.5 py-2.5 text-xs leading-relaxed text-[#57544E] shadow-sm">
          {busy && !job ? (
            <span>Synthesizing live deliverable & version narrative…</span>
          ) : error ? (
            <span className="text-rose-600">{error}</span>
          ) : job?.status === "FAILED" ? (
            <span className="text-rose-600">
              {job.error ?? "AI narrative requires OPENAI_API_KEY."}
            </span>
          ) : result?.narrative ? (
            <div className="space-y-2">
              <p>{result.narrative}</p>
              {result.suggestedNextActions &&
              result.suggestedNextActions.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-[#141413]">
                  {result.suggestedNextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <span>
              {defaultSummary ??
                "Your project state is derived deterministically from watched files. Click “Ask Assistant” for an AI status narrative."}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
