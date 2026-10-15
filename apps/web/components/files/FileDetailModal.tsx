"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn, formatBytes, formatDateTime, timeAgo } from "@/lib/utils";
import { Badge, Card } from "@/components/ui";
import { Button, ErrorText, Input, Select } from "@/components/form";
import { Modal } from "@/components/modal";

interface FileComment {
  id: string;
  body: string;
  status: "OPEN" | "RESOLVED";
  anchorJson?: { x?: number; y?: number } | null;
  convertedTaskId: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email?: string;
    accountType?: "DESIGNER" | "CLIENT";
    company?: string | null;
  } | null;
  replies?: FileComment[];
}

interface FileDetail {
  id: string;
  projectId: string;
  path: string;
  fileName: string;
  extension: string;
  mimeType: string;
  sizeBytes: string | number;
  sha256: string;
  kind: string;
  imageMeta?: {
    width?: number;
    height?: number;
    dominantColors?: string[];
  } | null;
  analyzedAt?: string | null;
  createdAt: string;
  previews?: Array<{ kind: string; storageKey: string }>;
  linkedRequirements?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    linkType: string;
    matchedBy: string;
    confidence: number | null;
  }>;
  latestBrandCheck?: {
    id: string;
    createdAt: string;
    checkType: string;
    status: string;
    findings: unknown;
    resolvedAt: string | null;
  } | null;
}

interface AiDesignReviewResult {
  verdict: "READY_FOR_APPROVAL" | "NEEDS_REVISION" | "BRAND_DRIFT_DETECTED";
  summary: string;
  critiquePoints: Array<{
    category: string;
    observation: string;
    suggestion: string;
  }>;
  suggestedComment: string;
  provider?: string;
  model?: string;
}

interface RequirementOption {
  id: string;
  title: string;
}

export default function FileDetailModal({
  fileId,
  projectId,
  projectSlug,
  isClient = false,
  canDownload = true,
  canComment = true,
  onClose,
  onChanged,
}: {
  fileId: string | null;
  projectId: string;
  projectSlug: string;
  isClient?: boolean;
  canDownload?: boolean;
  canComment?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [comments, setComments] = useState<FileComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [pinPoint, setPinPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [requirements, setRequirements] = useState<RequirementOption[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [aiReview, setAiReview] = useState<AiDesignReviewResult | null>(null);
  const [aiReviewBusy, setAiReviewBusy] = useState(false);

  const loadComments = useCallback(async (id: string) => {
    try {
      const list = await apiFetch<FileComment[]>(`/files/${id}/comments`);
      setComments(list);
    } catch {
      setComments([]);
    }
  }, []);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActionError(null);
    setActionNote(null);
    setPinPoint(null);
    setConfirmingDelete(false);

    Promise.all([
      apiFetch<FileDetail>(`/files/${fileId}`),
      apiFetch<FileComment[]>(`/files/${fileId}/comments`).catch(() => []),
    ])
      .then(([res, commentList]) => {
        if (!cancelled) {
          setDetail(res);
          setComments(commentList);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    if (!isClient) {
      apiFetch<RequirementOption[] | { items: RequirementOption[] }>(
        `/projects/${projectId}/requirements`,
      )
        .then((res) => {
          if (cancelled) return;
          if (Array.isArray(res)) {
            setRequirements(res);
          } else if (res && typeof res === "object" && "items" in res) {
            setRequirements(res.items);
          }
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [fileId, projectId, isClient]);

  if (!fileId) return null;

  async function withAction(fn: () => Promise<void>, note?: string) {
    setActionBusy(true);
    setActionError(null);
    setActionNote(null);
    try {
      await fn();
      if (note) setActionNote(note);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function handlePostComment() {
    if (!fileId || !commentBody.trim()) return;
    await withAction(async () => {
      await apiFetch("/comments", {
        method: "POST",
        body: JSON.stringify({
          fileId,
          body: commentBody.trim(),
          ...(pinPoint ? { anchor: pinPoint } : {}),
        }),
      });
      setCommentBody("");
      setPinPoint(null);
      await loadComments(fileId);
    }, "Review comment posted on file.");
  }

  async function handleResolveComment(commentId: string) {
    if (!fileId) return;
    await withAction(async () => {
      await apiFetch(`/comments/${commentId}/resolve`, { method: "POST" });
      await loadComments(fileId);
    }, "Comment marked as resolved.");
  }

  async function handleConvertCommentToTask(commentId: string) {
    if (!fileId) return;
    await withAction(async () => {
      await apiFetch(`/comments/${commentId}/convert-to-task`, {
        method: "POST",
      });
      await loadComments(fileId);
    }, "Client comment converted into a task on the Tasks board.");
  }

  async function handleRunAiDesignReview() {
    if (!fileId) return;
    setAiReviewBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch<AiDesignReviewResult>(
        `/files/${fileId}/ai-review`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setAiReview(res);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to run AI design review",
      );
    } finally {
      setAiReviewBusy(false);
    }
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!canComment) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x =
      Math.round(((event.clientX - rect.left) / rect.width) * 100) / 100;
    const y =
      Math.round(((event.clientY - rect.top) / rect.height) * 100) / 100;
    setPinPoint({
      x: Math.max(0.05, Math.min(0.95, x)),
      y: Math.max(0.05, Math.min(0.95, y)),
    });
  }

  const file = detail;

  return (
    <Modal
      open={Boolean(fileId)}
      onClose={onClose}
      title={file ? `Preview & Review — ${file.fileName}` : "Asset Preview"}
      width="max-w-4xl"
    >
      {loading ? (
        <p className="py-6 text-sm text-[#6B6860]">Loading artwork preview…</p>
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : !file ? null : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT 7 COLS: Visual Artwork Preview Canvas with Spatial Pinpoint Markers */}
          <div className="space-y-4 lg:col-span-7">
            <div
              onClick={handleCanvasClick}
              title={
                canComment
                  ? "Click anywhere on the artwork to drop a pinpoint review marker"
                  : undefined
              }
              className={cn(
                "relative overflow-hidden rounded-2xl border border-[#EBE7DF] bg-[#141413] shadow-card",
                canComment && "cursor-crosshair",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/v1/files/${file.id}/preview`}
                alt={file.fileName}
                className="max-h-[440px] w-full object-contain"
              />

              {/* Existing Spatial Pin Markers */}
              {comments.map((c, idx) => {
                const anchor = c.anchorJson;
                if (
                  !anchor ||
                  typeof anchor.x !== "number" ||
                  typeof anchor.y !== "number"
                ) {
                  return null;
                }
                return (
                  <span
                    key={c.id}
                    title={`${c.author?.name ?? "Reviewer"}: ${c.body}`}
                    style={{
                      left: `${anchor.x * 100}%`,
                      top: `${anchor.y * 100}%`,
                    }}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-float",
                      c.status === "RESOLVED"
                        ? "bg-emerald-500 text-white"
                        : "bg-[#9FE830] text-[#141413]",
                    )}
                  >
                    {idx + 1}
                  </span>
                );
              })}

              {/* Active New Pin Marker */}
              {pinPoint ? (
                <span
                  style={{
                    left: `${pinPoint.x * 100}%`,
                    top: `${pinPoint.y * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 animate-pulse items-center justify-center rounded-full border-2 border-white bg-[#7C3AED] text-xs font-bold text-white shadow-float"
                >
                  +
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6860]">
              <span>
                {canComment
                  ? "Tip: Click anywhere on the preview image to drop a spatial review pin."
                  : "Read-only preview mode"}
              </span>
              {pinPoint ? (
                <button
                  type="button"
                  onClick={() => setPinPoint(null)}
                  className="font-medium text-[#6D28D9] underline"
                >
                  Clear pin ({Math.round(pinPoint.x * 100)}%,{" "}
                  {Math.round(pinPoint.y * 100)}%)
                </button>
              ) : null}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-3 gap-2.5 rounded-2xl bg-[#FAF8F4] p-3.5 text-xs">
              <div>
                <p className="text-[#6B6860]">Path</p>
                <p className="truncate font-mono font-medium text-[#141413]">
                  {file.path}
                </p>
              </div>
              <div>
                <p className="text-[#6B6860]">Kind & Size</p>
                <p className="font-medium text-[#141413]">
                  {file.kind} · {formatBytes(file.sizeBytes)}
                </p>
              </div>
              <div>
                <p className="text-[#6B6860]">Dimensions</p>
                <p className="font-medium text-[#141413]">
                  {file.imageMeta?.width && file.imageMeta?.height
                    ? `${file.imageMeta.width}×${file.imageMeta.height}px`
                    : file.mimeType}
                </p>
              </div>
              {file.imageMeta?.dominantColors &&
              file.imageMeta.dominantColors.length > 0 ? (
                <div className="col-span-3 flex items-center gap-2 border-t border-[#EBE7DF] pt-2">
                  <span className="text-[#6B6860]">Detected Palette:</span>
                  {file.imageMeta.dominantColors.map((hex) => (
                    <span
                      key={hex}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 font-mono text-[11px] shadow-pill"
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-black/10"
                        style={{ backgroundColor: hex }}
                      />
                      {hex}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Actions Footer: Download / Delete */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {canDownload ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={actionBusy}
                  onClick={() =>
                    void withAction(async () => {
                      const res = await apiFetch<{ url: string }>(
                        `/files/${fileId}/download`,
                      );
                      window.open(res.url, "_blank", "noopener,noreferrer");
                    })
                  }
                >
                  Download Original File
                </Button>
              ) : (
                <Badge tone="neutral">Download restricted by studio</Badge>
              )}

              {!isClient ? (
                confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-600">
                      Delete this file?
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={actionBusy}
                      onClick={() =>
                        void withAction(async () => {
                          await apiFetch(`/files/${fileId}`, {
                            method: "DELETE",
                          });
                          onClose();
                        })
                      }
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
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600"
                    disabled={actionBusy}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete File
                  </Button>
                )
              ) : null}
            </div>
          </div>

          {/* RIGHT 5 COLS: Groq AI Design Reviewer + Client & Designer Review Thread + Deliverable/Brand Info */}
          <div className="flex flex-col justify-between space-y-3.5 lg:col-span-5">
            {/* Groq AI Design Reviewer & Feedback Assistant */}
            <div className="rounded-2xl border border-sky-200/80 bg-ai-sky p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#141413] text-[11px] font-bold text-white">
                    ✦
                  </span>
                  <span className="text-xs font-semibold text-[#141413]">
                    Groq AI Design Reviewer
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={aiReviewBusy}
                  onClick={() => void handleRunAiDesignReview()}
                >
                  {aiReviewBusy ? "Analyzing…" : "Run AI Review"}
                </Button>
              </div>

              {aiReview ? (
                <div className="mt-3 space-y-2.5 rounded-xl border border-white/80 bg-white/85 p-3 text-xs backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Badge
                      tone={
                        aiReview.verdict === "READY_FOR_APPROVAL"
                          ? "lime"
                          : aiReview.verdict === "BRAND_DRIFT_DETECTED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {aiReview.verdict.replace(/_/g, " ")}
                    </Badge>
                    <span className="font-mono text-[10px] text-[#6B6860]">
                      {aiReview.provider === "groq"
                        ? `Groq · ${aiReview.model}`
                        : "Smart QA Analyzer"}
                    </span>
                  </div>
                  <p className="leading-relaxed text-[#141413]">
                    {aiReview.summary}
                  </p>
                  <ul className="space-y-1.5 border-t border-[#F2EFE8] pt-2">
                    {aiReview.critiquePoints.map((pt, i) => (
                      <li key={i} className="text-[11px]">
                        <strong className="text-[#141413]">
                          {pt.category}:
                        </strong>{" "}
                        <span className="text-[#57544E]">{pt.observation}</span>{" "}
                        <span className="font-medium text-[#6D28D9]">
                          → {pt.suggestion}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {canComment ? (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setCommentBody(aiReview.suggestedComment)}
                        className="rounded-full bg-[#141413] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#2A2927]"
                      >
                        Use Suggested Review Comment ↓
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-[#57544E]">
                  Click &ldquo;Run AI Review&rdquo; to evaluate palette ΔE
                  compliance, deliverable specs, and client feedback using Groq
                  LLM.
                </p>
              )}
            </div>

            {/* Client & Team Review Thread */}
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#141413]">
                  Client & Studio Reviews ({comments.length})
                </p>
                <Badge tone="lime">Live Annotations</Badge>
              </div>

              {comments.length === 0 ? (
                <p className="py-4 text-center text-xs text-[#6B6860]">
                  No review notes on this asset yet. Click on the preview to pin
                  a comment below.
                </p>
              ) : (
                <ul className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
                  {comments.map((c, idx) => (
                    <li
                      key={c.id}
                      className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {c.anchorJson &&
                          typeof c.anchorJson.x === "number" ? (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#9FE830] text-[10px] font-bold text-[#141413]">
                              {idx + 1}
                            </span>
                          ) : null}
                          <span className="font-semibold text-[#141413]">
                            {c.author?.name ?? "Reviewer"}
                          </span>
                          <Badge
                            tone={
                              c.author?.accountType === "CLIENT"
                                ? "info"
                                : "neutral"
                            }
                          >
                            {c.author?.accountType ?? "TEAM"}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-[#9A968C]">
                          {timeAgo(c.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1.5 leading-relaxed text-[#141413]">
                        {c.body}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-[#EBE7DF] pt-2">
                        <Badge
                          tone={c.status === "RESOLVED" ? "lime" : "warning"}
                        >
                          {c.status}
                        </Badge>
                        {!isClient ? (
                          <div className="flex items-center gap-1">
                            {!c.convertedTaskId ? (
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() =>
                                  void handleConvertCommentToTask(c.id)
                                }
                                className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#6D28D9] shadow-pill hover:bg-[#F3EEFF]"
                              >
                                → Task
                              </button>
                            ) : (
                              <Badge tone="violet">Task Linked</Badge>
                            )}
                            {c.status !== "RESOLVED" ? (
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void handleResolveComment(c.id)}
                                className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#15803D] shadow-pill hover:bg-emerald-50"
                              >
                                ✓ Resolve
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {canComment ? (
                <div className="mt-3 space-y-2 border-t border-[#F2EFE8] pt-3">
                  {pinPoint ? (
                    <p className="text-[11px] font-medium text-[#6D28D9]">
                      📍 Pinned at ({Math.round(pinPoint.x * 100)}%,{" "}
                      {Math.round(pinPoint.y * 100)}%) on canvas
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Input
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Write review feedback on this file…"
                    />
                    <Button
                      size="sm"
                      disabled={actionBusy || !commentBody.trim()}
                      onClick={() => void handlePostComment()}
                    >
                      Post
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>

            {/* Linked Requirements & Brand QA (Shown to all, editable by Designer) */}
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6B6860]">
                Satisfied Requirements
              </p>
              {(file.linkedRequirements ?? []).length === 0 ? (
                <p className="text-xs text-[#6B6860]">
                  Not linked to a requirement yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(file.linkedRequirements ?? []).map((link) => (
                    <Badge key={link.id} tone="lime">
                      ✓ {link.title}
                    </Badge>
                  ))}
                </div>
              )}

              {!isClient ? (
                <div className="mt-3 flex items-center gap-2">
                  <Select
                    value={selectedRequirementId}
                    onChange={(e) => setSelectedRequirementId(e.target.value)}
                    className="py-1.5 text-xs"
                  >
                    <option value="">Link to requirement…</option>
                    {requirements.map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.title}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!selectedRequirementId || actionBusy}
                    onClick={() =>
                      void withAction(async () => {
                        await apiFetch(
                          `/requirements/${selectedRequirementId}/link-file`,
                          {
                            method: "POST",
                            body: JSON.stringify({ fileId }),
                          },
                        );
                      }, "Linked to requirement.")
                    }
                  >
                    Link
                  </Button>
                </div>
              ) : null}

              <div className="mt-4 border-t border-[#F2EFE8] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B6860]">
                    Brand QA Status
                  </span>
                  {file.latestBrandCheck ? (
                    <Badge
                      tone={
                        file.latestBrandCheck.status === "PASS"
                          ? "lime"
                          : file.latestBrandCheck.status === "WARNING"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {file.latestBrandCheck.status}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Unchecked</Badge>
                  )}
                </div>
                {!isClient ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2 w-full"
                    disabled={actionBusy}
                    onClick={() =>
                      void withAction(async () => {
                        await apiFetch(`/files/${fileId}/recheck-brand`, {
                          method: "POST",
                        });
                      }, "Brand check completed.")
                    }
                  >
                    Re-run Brand Check
                  </Button>
                ) : null}
              </div>
            </Card>

            {actionError ? <ErrorText>{actionError}</ErrorText> : null}
            {actionNote ? (
              <p className="text-xs font-medium text-emerald-700">
                {actionNote}
              </p>
            ) : null}
            <p className="text-right text-[11px] text-[#9A968C]">
              {projectSlug} · {formatDateTime(file.createdAt)}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
