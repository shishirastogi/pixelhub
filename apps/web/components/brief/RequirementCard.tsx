"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { pollAiJob } from "@/lib/poll";
import { formatDate } from "@/lib/utils";
import { Badge, ProgressBar } from "@/components/ui";
import { Button, ErrorText, Input } from "@/components/form";
import { FilePickerModal } from "@/components/file-picker-modal";
import type { RequirementItem } from "./BriefTab";

interface RequirementDetail {
  deliverables: Array<{
    id: string;
    name: string;
    status: string;
    satisfiedByFileId: string | null;
  }>;
  links: Array<{
    fileId: string;
    linkType: string;
    matchedBy: string;
    confidence: number | null;
    file: {
      id: string;
      fileName: string;
      path: string;
      kind: string;
      previewStorageKey: string | null;
    };
  }>;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "info"> =
  {
    PENDING: "warning",
    ACCEPTED: "info",
    FULFILLED: "success",
    REJECTED: "neutral",
  };

const PRIORITY_TONE: Record<string, "neutral" | "warning" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "danger",
};

export default function RequirementCard({
  requirement,
  projectId,
  onChanged,
  onEdit,
}: {
  requirement: RequirementItem;
  projectId: string;
  onChanged: () => void;
  onEdit: (requirement: RequirementItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<RequirementDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState({
    name: "",
    pattern: "",
  });

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const res = await apiFetch<RequirementDetail>(
        `/requirements/${requirement.id}/files`,
      );
      setDetail(res);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to load requirement",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, [requirement.id]);

  useEffect(() => {
    if (expanded && !detail) void loadDetail();
  }, [expanded, detail, loadDetail]);

  const overdue =
    requirement.dueDate !== null &&
    requirement.status !== "FULFILLED" &&
    new Date(requirement.dueDate).getTime() < Date.now();

  const { satisfied, total } = requirement.coverage;

  async function withAction(fn: () => Promise<void>, note?: string) {
    setActionBusy(true);
    setActionError(null);
    setResultNote(null);
    try {
      await fn();
      if (note) setResultNote(note);
      await loadDetail();
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function generateTasks() {
    setActionBusy(true);
    setActionError(null);
    setResultNote("Generating task checklist…");
    try {
      const { jobId } = await apiFetch<{ jobId: string }>(
        `/requirements/${requirement.id}/generate-tasks`,
        { method: "POST" },
      );
      const job = await pollAiJob(jobId);
      setResultNote(
        job.status === "SUCCEEDED"
          ? "Task checklist generated — see the Tasks tab."
          : (job.error ?? `Job ${job.status.toLowerCase()}.`),
      );
      onChanged();
    } catch (err) {
      setResultNote(null);
      setActionError(
        err instanceof Error ? err.message : "Failed to generate tasks",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete() {
    setActionBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/requirements/${requirement.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete");
      setActionBusy(false);
    }
  }

  const deliverables = detail?.deliverables ?? requirement.deliverables;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-800">
              {requirement.title}
            </span>
            <Badge tone={STATUS_TONE[requirement.status] ?? "neutral"}>
              {requirement.status}
            </Badge>
            <Badge tone={PRIORITY_TONE[requirement.priority] ?? "neutral"}>
              {requirement.priority}
            </Badge>
            {overdue ? <Badge tone="danger">OVERDUE</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {requirement.source === "AI_EXTRACTED" ? "AI-extracted · " : ""}
            Qty {requirement.quantity}
            {requirement.dueDate
              ? ` · due ${formatDate(requirement.dueDate)}`
              : ""}
          </p>
        </div>
        <div className="w-32 shrink-0">
          <div className="mb-1 text-right text-xs text-neutral-500">
            {satisfied}/{total} satisfied
          </div>
          <ProgressBar
            value={total > 0 ? (satisfied / total) * 100 : 0}
            tone={total > 0 && satisfied === total ? "emerald" : "rose"}
          />
        </div>
        <span className="mt-0.5 text-neutral-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
          {requirement.description ? (
            <p className="text-sm text-neutral-600">
              {requirement.description}
            </p>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Deliverables
            </p>
            {loadingDetail && !detail ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : deliverables.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No deliverables yet — add one so files can auto-match.
              </p>
            ) : (
              <ul className="space-y-1">
                {deliverables.map((deliverable) => (
                  <li
                    key={deliverable.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <Badge
                      tone={
                        deliverable.status === "SATISFIED"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {deliverable.status === "SATISFIED" ? "✓" : "○"}
                    </Badge>
                    <span className="font-medium text-neutral-700">
                      {deliverable.name}
                    </span>
                    {"filePatterns" in deliverable &&
                    Array.isArray(deliverable.filePatterns) ? (
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                        {deliverable.filePatterns.join(", ")}
                      </code>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                value={newDeliverable.name}
                onChange={(e) =>
                  setNewDeliverable((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Deliverable name"
                className="max-w-44"
              />
              <Input
                value={newDeliverable.pattern}
                onChange={(e) =>
                  setNewDeliverable((prev) => ({
                    ...prev,
                    pattern: e.target.value,
                  }))
                }
                placeholder="File pattern…"
                className="max-w-56 font-mono text-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={
                  actionBusy ||
                  !newDeliverable.name.trim() ||
                  !newDeliverable.pattern.trim()
                }
                onClick={() =>
                  withAction(async () => {
                    await apiFetch(
                      `/requirements/${requirement.id}/deliverables`,
                      {
                        method: "POST",
                        body: JSON.stringify({
                          name: newDeliverable.name.trim(),
                          filePatterns: [newDeliverable.pattern.trim()],
                        }),
                      },
                    );
                    setNewDeliverable({ name: "", pattern: "" });
                  })
                }
              >
                Add deliverable
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Linked files
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionBusy}
                onClick={() => setPickerOpen(true)}
              >
                Link file
              </Button>
            </div>
            {(detail?.links ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">No files linked yet.</p>
            ) : (
              <ul className="space-y-1">
                {detail?.links.map((link) => (
                  <li
                    key={link.fileId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-1.5 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="truncate font-medium text-neutral-700">
                        {link.file.fileName}
                      </span>
                      <span className="ml-2 text-xs text-neutral-400">
                        {link.matchedBy.replace(/_/g, " ").toLowerCase()}
                        {link.confidence !== null
                          ? ` · ${Math.round(link.confidence * 100)}%`
                          : ""}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionBusy}
                      className="text-neutral-400"
                      aria-label="Unlink file"
                      onClick={() =>
                        withAction(async () => {
                          await apiFetch(
                            `/requirements/${requirement.id}/link-file/${link.fileId}`,
                            { method: "DELETE" },
                          );
                        })
                      }
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={actionBusy}
              onClick={() => onEdit(requirement)}
            >
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={actionBusy || deliverables.length === 0}
              title={
                deliverables.length === 0
                  ? "Add a deliverable to enable matching"
                  : undefined
              }
              onClick={() =>
                withAction(async () => {
                  await apiFetch(
                    `/deliverables/${deliverables[0]!.id}/rematch`,
                    { method: "POST" },
                  );
                }, "Re-matched files against deliverables.")
              }
            >
              Re-match files
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={actionBusy}
              onClick={generateTasks}
            >
              Generate tasks
            </Button>
            {confirmingDelete ? (
              <span className="flex items-center gap-2">
                <span className="text-sm text-rose-600">Delete this?</span>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={actionBusy}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600"
                disabled={actionBusy}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>

          {actionError ? <ErrorText>{actionError}</ErrorText> : null}
          {resultNote ? (
            <p className="text-xs text-emerald-600">{resultNote}</p>
          ) : null}
        </div>
      ) : null}

      <FilePickerModal
        projectId={projectId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(file) =>
          void withAction(async () => {
            await apiFetch(`/requirements/${requirement.id}/link-file`, {
              method: "POST",
              body: JSON.stringify({ fileId: file.id }),
            });
          }, `Linked ${file.fileName}.`)
        }
      />
    </div>
  );
}
