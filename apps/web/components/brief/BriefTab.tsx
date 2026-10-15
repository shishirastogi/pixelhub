"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import { pollAiJob } from "@/lib/poll";
import { cn, timeAgo } from "@/lib/utils";
import { Badge, Card, CardTitle } from "@/components/ui";
import {
  Button,
  EmptyState,
  ErrorText,
  Input,
  Textarea,
} from "@/components/form";
import UploadButton from "@/components/files/UploadButton";
import RequirementCard from "./RequirementCard";
import RequirementModal from "./RequirementModal";

export interface DeliverableItem {
  id: string;
  name: string;
  filePatterns: string[];
  status: string;
  satisfiedByFileId: string | null;
}

export interface RequirementItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source: string;
  quantity: number;
  dueDate: string | null;
  priority: string;
  deliverables: DeliverableItem[];
  coverage: { satisfied: number; total: number };
  createdAt: string;
}

export interface BriefAttachment {
  id: string;
  fileName: string;
  path: string;
  kind: string;
}

export interface BriefInfo {
  id: string;
  title: string;
  rawText: string;
  updatedAt: string;
  sourceFile: BriefAttachment | null;
}

type Filter = "ALL" | "FULFILLED" | "OUTSTANDING" | "OVERDUE";

function isOverdue(requirement: RequirementItem): boolean {
  return (
    requirement.status !== "FULFILLED" &&
    requirement.dueDate !== null &&
    new Date(requirement.dueDate).getTime() < Date.now()
  );
}

export default function BriefTab({
  projectId,
  initialBrief,
  initialRequirements,
}: {
  projectId: string;
  initialBrief: BriefInfo | null;
  initialRequirements: RequirementItem[];
}) {
  const [title, setTitle] = useState(initialBrief?.title ?? "Brief");
  const [rawText, setRawText] = useState(initialBrief?.rawText ?? "");
  const [sourceFile, setSourceFile] = useState<BriefAttachment | null>(
    initialBrief?.sourceFile ?? null,
  );
  const [savedAt, setSavedAt] = useState<string | null>(
    initialBrief?.updatedAt ?? null,
  );
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefNote, setBriefNote] = useState<string | null>(null);

  const [requirements, setRequirements] =
    useState<RequirementItem[]>(initialRequirements);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RequirementItem | null>(null);

  const refresh = useCallback(async () => {
    const list = await apiFetch<RequirementItem[]>(
      `/projects/${projectId}/requirements`,
    );
    setRequirements(list);
  }, [projectId]);

  async function saveBrief(extra?: { sourceFileId: string | null }) {
    if (!rawText.trim()) {
      setBriefError("Write or paste the brief before saving.");
      return;
    }
    setBriefBusy(true);
    setBriefError(null);
    setBriefNote(null);
    try {
      const res = await apiFetch<BriefInfo>(`/projects/${projectId}/brief`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim() || "Brief",
          rawText,
          sourceFileId:
            extra?.sourceFileId !== undefined
              ? extra.sourceFileId
              : (sourceFile?.id ?? null),
        }),
      });
      setSavedAt(res.updatedAt ?? new Date().toISOString());
      setBriefNote("Brief saved.");
    } catch (err) {
      setBriefError(
        err instanceof Error ? err.message : "Failed to save brief",
      );
    } finally {
      setBriefBusy(false);
    }
  }

  async function handleBriefUploaded(ids: string[]) {
    const fileId = ids[0];
    if (!fileId) return;

    setBriefError(null);
    setBriefNote(null);
    try {
      const file = await apiFetch<BriefAttachment>(`/files/${fileId}`);
      setSourceFile(file);
      if (rawText.trim()) {
        await saveBrief({ sourceFileId: fileId });
      } else {
        setBriefNote("Brief file uploaded — add the brief text, then Save.");
      }
    } catch (err) {
      setBriefError(
        err instanceof Error ? err.message : "Failed to attach brief file",
      );
    }
  }

  async function extract() {
    if (!rawText.trim()) {
      setExtractError("Save a brief before extracting requirements.");
      return;
    }
    setExtracting(true);
    setExtractError(null);
    setExtractNote(null);
    try {
      const { jobId } = await apiFetch<{ jobId: string }>(
        `/projects/${projectId}/brief/extract`,
        { method: "POST" },
      );
      const job = await pollAiJob(jobId);
      if (job.status === "SUCCEEDED") {
        await refresh();
        setExtractNote(
          "Extraction complete — review the proposed requirements below and accept or dismiss them.",
        );
      } else {
        setExtractError(job.error ?? `Extraction ${job.status.toLowerCase()}.`);
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function setRequirementStatus(
    id: string,
    status: "ACCEPTED" | "REJECTED",
  ) {
    setActingId(id);
    setExtractError(null);
    try {
      await apiFetch(`/requirements/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Failed to update requirement",
      );
    } finally {
      setActingId(null);
    }
  }

  const proposals = requirements.filter((r) => r.status === "PENDING");
  const active = requirements.filter(
    (r) => r.status !== "PENDING" && r.status !== "REJECTED",
  );

  const counts: Record<Filter, number> = {
    ALL: active.length,
    FULFILLED: active.filter((r) => r.status === "FULFILLED").length,
    OUTSTANDING: active.filter(
      (r) => r.status === "ACCEPTED" && r.coverage.satisfied < r.coverage.total,
    ).length,
    OVERDUE: active.filter(isOverdue).length,
  };

  const visible = active.filter((requirement) => {
    if (filter === "ALL") return true;
    if (filter === "FULFILLED") return requirement.status === "FULFILLED";
    if (filter === "OVERDUE") return isOverdue(requirement);
    return (
      requirement.status === "ACCEPTED" &&
      requirement.coverage.satisfied < requirement.coverage.total
    );
  });

  const FILTERS: Filter[] = ["ALL", "FULFILLED", "OUTSTANDING", "OVERDUE"];

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle
          hint={
            savedAt ? (
              <span className="text-xs text-neutral-400">
                Saved {timeAgo(savedAt)}
              </span>
            ) : null
          }
        >
          Project brief
        </CardTitle>

        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief title"
            className="max-w-md font-medium"
          />
          <Textarea
            rows={8}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the client brief here — goals, deliverables, deadlines, brand notes…"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => saveBrief()} disabled={briefBusy}>
              {briefBusy ? "Saving…" : "Save brief"}
            </Button>
            <UploadButton
              projectId={projectId}
              pathPrefix="brief/"
              kind="BRIEF_DOC"
              label="Upload brief file"
              onUploaded={(ids) => void handleBriefUploaded(ids)}
            />
            <Button
              variant="secondary"
              disabled={extracting || !rawText.trim()}
              onClick={extract}
            >
              {extracting ? "Extracting…" : "Extract requirements"}
            </Button>
          </div>

          {sourceFile ? (
            <p className="text-xs text-neutral-500">
              Attached file:{" "}
              <span className="font-medium text-neutral-700">
                {sourceFile.fileName}
              </span>
            </p>
          ) : null}
          {briefNote ? (
            <p className="text-xs text-emerald-600">{briefNote}</p>
          ) : null}
          {briefError ? <ErrorText>{briefError}</ErrorText> : null}
        </div>
      </Card>

      {extractNote ? (
        <p className="text-sm text-emerald-700">{extractNote}</p>
      ) : null}
      {extractError ? <ErrorText>{extractError}</ErrorText> : null}

      {proposals.length > 0 ? (
        <div className="rounded-[24px] border border-sky-200/80 bg-ai-sky p-6 shadow-card">
          <CardTitle
            hint={<Badge tone="lime">{proposals.length} AI Proposals</Badge>}
          >
            Proposed Requirements — AI Extraction
          </CardTitle>
          <div className="space-y-2.5">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#141413]">
                      {proposal.title}
                    </span>
                    <Badge tone="warning">PENDING</Badge>
                    {proposal.quantity > 1 ? (
                      <span className="text-xs text-[#6B6860]">
                        ×{proposal.quantity}
                      </span>
                    ) : null}
                  </div>
                  {proposal.description ? (
                    <p className="mt-0.5 text-xs text-[#6B6860]">
                      {proposal.description}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-[#9A968C]">
                    {proposal.deliverables.length} deliverable
                    {proposal.deliverables.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="lime"
                    disabled={actingId === proposal.id}
                    onClick={() =>
                      void setRequirementStatus(proposal.id, "ACCEPTED")
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actingId === proposal.id}
                    onClick={() =>
                      void setRequirementStatus(proposal.id, "REJECTED")
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Card>
        <CardTitle
          hint={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              + Add requirement
            </Button>
          }
        >
          Requirements & Deliverable Contracts
        </CardTitle>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                filter === f
                  ? "border-[#141413] bg-[#141413] text-white shadow-pill"
                  : "border-[#EBE7DF] bg-[#FAF8F4] text-[#57544E] hover:bg-[#F3F1EC]",
              )}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}{" "}
              <span className="ml-1 opacity-75">{counts[f]}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={
              requirements.length === 0
                ? "No requirements yet"
                : "Nothing here under this filter"
            }
            description={
              requirements.length === 0
                ? "Add requirements manually, or paste the brief and let AI extract them."
                : "Try another filter."
            }
          />
        ) : (
          <div className="space-y-2">
            {visible.map((requirement) => (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
                projectId={projectId}
                onChanged={() => void refresh()}
                onEdit={(r) => {
                  setEditing(r);
                  setModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </Card>

      <RequirementModal
        key={editing?.id ?? (modalOpen ? "new" : "closed")}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        projectId={projectId}
        requirement={
          editing
            ? {
                id: editing.id,
                title: editing.title,
                description: editing.description,
                quantity: editing.quantity,
                dueDate: editing.dueDate,
                priority: editing.priority,
              }
            : null
        }
        onSaved={() => void refresh()}
      />
    </div>
  );
}
