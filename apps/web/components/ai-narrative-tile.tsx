"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Badge, Card, CardTitle } from "@/components/ui";

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

export function AiNarrativeTile({ projectId }: { projectId: string }) {
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
    <Card className="flex h-full flex-col">
      <CardTitle
        hint={
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
          >
            {busy ? "Working…" : "Refresh with AI"}
          </button>
        }
      >
        AI health narrative
      </CardTitle>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {busy && !job ? (
        <p className="text-sm text-neutral-500">
          Asking the assistant where this project stands…
        </p>
      ) : null}

      {job?.status === "FAILED" ? (
        <p className="text-sm text-rose-600">
          {job.error ?? "The AI request failed."}
        </p>
      ) : null}

      {result?.narrative ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-neutral-700">
            {result.narrative}
          </p>
          {result.suggestedNextActions && result.suggestedNextActions.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Suggested next
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-neutral-600">
                {result.suggestedNextActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {!busy && !job && !error ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-500">
            Generate a plain-English summary of project status.
          </p>
          <Badge tone="neutral">Requires OPENAI_API_KEY</Badge>
        </div>
      ) : null}
    </Card>
  );
}
