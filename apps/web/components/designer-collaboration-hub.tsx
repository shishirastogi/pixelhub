"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn, formatBytes, timeAgo } from "@/lib/utils";
import { Badge, Card, CardTitle } from "@/components/ui";
import { Button, ErrorText, Input } from "@/components/form";
import FileDetailModal from "@/components/files/FileDetailModal";

export interface CollaborationFileItem {
  id: string;
  fileName: string;
  path: string;
  kind: string;
  extension: string;
  sizeBytes: string | number;
  createdAt: string;
  linkedRequirementCount?: number;
}

export interface CollaborationCommentItem {
  id: string;
  body: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  convertedTaskId: string | null;
  fileId: string | null;
  versionId: string | null;
  anchorJson?: { x?: number; y?: number } | null;
  author: {
    id: string;
    name: string;
    email?: string;
    accountType?: "DESIGNER" | "CLIENT";
    company?: string | null;
  } | null;
  file?: {
    id: string;
    fileName: string;
    path: string;
  } | null;
  version?: {
    id: string;
    number: number;
    label: string | null;
  } | null;
}

export interface CollaborationProposalItem {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  priority: string;
}

export interface CollaborationAccessRequestItem {
  id: string;
  email: string;
  message: string | null;
  createdAt: string;
  user?: {
    name: string;
    company?: string | null;
  } | null;
}

export function DesignerCollaborationHub({
  projectId,
  projectSlug,
  files,
  initialComments,
  initialProposals,
  initialRequests,
  isClient,
  canViewFiles,
  canDownloadFiles,
  canComment,
}: {
  projectId: string;
  projectSlug: string;
  files: CollaborationFileItem[];
  initialComments: CollaborationCommentItem[];
  initialProposals: CollaborationProposalItem[];
  initialRequests: CollaborationAccessRequestItem[];
  isClient: boolean;
  canViewFiles: boolean;
  canDownloadFiles: boolean;
  canComment: boolean;
}) {
  const router = useRouter();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [comments, setComments] =
    useState<CollaborationCommentItem[]>(initialComments);
  const [proposals, setProposals] =
    useState<CollaborationProposalItem[]>(initialProposals);
  const [requests, setRequests] =
    useState<CollaborationAccessRequestItem[]>(initialRequests);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function refreshComments() {
    try {
      const list = await apiFetch<CollaborationCommentItem[]>(
        `/projects/${projectId}/comments`,
      );
      setComments(list);
    } catch {
      // non-blocking
    }
  }

  async function handleResolveComment(commentId: string) {
    setBusyId(commentId);
    setError(null);
    try {
      await apiFetch(`/comments/${commentId}/resolve`, { method: "POST" });
      await refreshComments();
      setNote("Feedback marked as resolved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setBusyId(null);
    }
  }

  async function handleConvertToTask(commentId: string) {
    setBusyId(commentId);
    setError(null);
    try {
      await apiFetch(`/comments/${commentId}/convert-to-task`, {
        method: "POST",
      });
      await refreshComments();
      setNote("Client feedback converted to a task on the Tasks board.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePostReply(parent: CollaborationCommentItem) {
    if (!replyText.trim()) return;
    setBusyId(parent.id);
    setError(null);
    try {
      await apiFetch("/comments", {
        method: "POST",
        body: JSON.stringify({
          parentCommentId: parent.id,
          fileId: parent.fileId,
          versionId: parent.versionId,
          body: replyText.trim(),
        }),
      });
      setReplyText("");
      setReplyFor(null);
      await refreshComments();
      setNote("Reply posted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setBusyId(null);
    }
  }

  async function handleProposalAction(
    id: string,
    status: "ACCEPTED" | "REJECTED",
  ) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/requirements/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setProposals((prev) => prev.filter((p) => p.id !== id));
      setNote(
        status === "ACCEPTED"
          ? "Proposal accepted into project requirements."
          : "Proposal dismissed.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update proposal");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAccessRequest(
    inviteId: string,
    status: "ACCEPTED" | "DECLINED",
  ) {
    setBusyId(inviteId);
    setError(null);
    try {
      await apiFetch(`/invites/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setRequests((prev) => prev.filter((r) => r.id !== inviteId));
      setNote(
        status === "ACCEPTED"
          ? "Client access request approved."
          : "Client access request declined.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to handle request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {note ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
          {note}
        </p>
      ) : null}

      {/* 1. VISUAL DELIVERABLE & ASSET SHOWCASE (Both Client & Designer can preview & review) */}
      {canViewFiles && files.length > 0 ? (
        <Card>
          <CardTitle
            hint={
              <Badge tone="lime">
                Click any artwork to preview & drop pinpoint reviews
              </Badge>
            }
          >
            {isClient
              ? "Project Deliverables & Visual Review Gallery"
              : "Live Project Artworks & Deliverables"}
          </CardTitle>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.slice(0, 6).map((file) => {
              const fileCommentCount = comments.filter(
                (c) => c.fileId === file.id,
              ).length;
              return (
                <div
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[22px] border border-[#EBE7DF] bg-[#FAF8F4] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#141413]/30 hover:bg-white hover:shadow-card"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#141413]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/v1/files/${file.id}/preview`}
                      alt={file.fileName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3 flex items-center gap-1.5">
                      <Badge tone="dark">{file.kind}</Badge>
                      {(file.linkedRequirementCount ?? 0) > 0 ? (
                        <Badge tone="lime">✓ Deliverable</Badge>
                      ) : null}
                    </div>
                    {fileCommentCount > 0 ? (
                      <div className="absolute right-3 top-3">
                        <Badge tone="violet">
                          💬 {fileCommentCount} review
                          {fileCommentCount === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    ) : null}
                  </div>

                  <div className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-[#141413]">
                        {file.fileName}
                      </p>
                      <span className="shrink-0 text-[11px] text-[#6B6860]">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-[#6B6860]">
                        {file.path}
                      </span>
                      <span className="font-semibold text-[#6D28D9] group-hover:underline">
                        Preview & Review →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* 2. DESIGNER HUB: Client Feedback, Proposals & Access Requests */}
      {!isClient ? (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Client Feedback & Review Inbox */}
          <Card className="lg:col-span-7">
            <CardTitle
              hint={
                <Badge tone="violet">
                  {comments.filter((c) => c.status === "OPEN").length} open
                  reviews
                </Badge>
              }
            >
              Client Feedback & File Reviews
            </CardTitle>

            {comments.length === 0 ? (
              <p className="text-xs text-[#6B6860]">
                No client feedback or review notes yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.slice(0, 6).map((c) => (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3.5 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {c.file ? (
                          <button
                            type="button"
                            onClick={() => setSelectedFileId(c.file!.id)}
                            className="shrink-0 overflow-hidden rounded-xl border border-[#EBE7DF]"
                            title={`Preview ${c.file.fileName}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/v1/files/${c.file.id}/preview`}
                              alt={c.file.fileName}
                              className="h-10 w-10 object-cover"
                            />
                          </button>
                        ) : null}
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
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
                              {c.author?.accountType ?? "DESIGNER"}
                            </Badge>
                            {c.file ? (
                              <button
                                type="button"
                                onClick={() => setSelectedFileId(c.file!.id)}
                                className="font-mono text-[11px] font-medium text-[#6D28D9] underline"
                              >
                                on {c.file.fileName}
                              </button>
                            ) : c.version ? (
                              <Badge tone="violet">
                                Snapshot v{c.version.number}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 leading-relaxed text-[#141413]">
                            “{c.body}”
                          </p>
                        </div>
                      </div>

                      <Badge
                        tone={c.status === "RESOLVED" ? "lime" : "warning"}
                      >
                        {c.status}
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#EBE7DF] pt-2">
                      <span className="text-[11px] text-[#9A968C]">
                        {timeAgo(c.createdAt)}
                        {c.anchorJson && typeof c.anchorJson.x === "number"
                          ? ` · 📍 Pinned (${Math.round(c.anchorJson.x * 100)}%, ${Math.round((c.anchorJson.y ?? 0) * 100)}%)`
                          : ""}
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.file ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedFileId(c.file!.id)}
                          >
                            Preview File
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setReplyFor((prev) =>
                              prev === c.id ? null : c.id,
                            )
                          }
                        >
                          Reply
                        </Button>
                        {!c.convertedTaskId ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyId === c.id}
                            onClick={() => void handleConvertToTask(c.id)}
                          >
                            → Convert to Task
                          </Button>
                        ) : (
                          <Badge tone="violet">Task Created</Badge>
                        )}
                        {c.status !== "RESOLVED" ? (
                          <Button
                            size="sm"
                            variant="lime"
                            disabled={busyId === c.id}
                            onClick={() => void handleResolveComment(c.id)}
                          >
                            ✓ Resolve
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {replyFor === c.id ? (
                      <div className="mt-2.5 flex items-center gap-2 pt-1">
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to ${c.author?.name ?? "client"}…`}
                          className="py-1.5 text-xs"
                        />
                        <Button
                          size="sm"
                          disabled={busyId === c.id || !replyText.trim()}
                          onClick={() => void handlePostReply(c)}
                        >
                          Send
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Right Column: Proposals & Client Access Requests */}
          <Card className="lg:col-span-5">
            <CardTitle
              hint={
                <Badge tone="lime">
                  {proposals.length + requests.length} pending
                </Badge>
              }
            >
              Proposals & Access Requests
            </CardTitle>

            <div className="space-y-4 text-xs">
              <div>
                <p className="mb-2 font-semibold uppercase tracking-wider text-[#6B6860]">
                  Client Access Requests ({requests.length})
                </p>
                {requests.length === 0 ? (
                  <p className="rounded-xl bg-[#FAF8F4] p-3 text-[#6B6860]">
                    No pending client access requests for this project.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#141413]">
                            {req.user?.name ?? req.email}
                          </span>
                          <span className="text-[11px] text-[#6B6860]">
                            {timeAgo(req.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B6860]">
                          {req.email}
                          {req.user?.company ? ` · ${req.user.company}` : ""}
                        </p>
                        {req.message ? (
                          <p className="mt-1 italic text-[#57544E]">
                            “{req.message}”
                          </p>
                        ) : null}
                        <div className="mt-2.5 flex gap-2">
                          <Button
                            size="sm"
                            variant="lime"
                            disabled={busyId === req.id}
                            onClick={() =>
                              void handleAccessRequest(req.id, "ACCEPTED")
                            }
                          >
                            Approve Client Access
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === req.id}
                            onClick={() =>
                              void handleAccessRequest(req.id, "DECLINED")
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-[#F2EFE8] pt-3">
                <p className="mb-2 font-semibold uppercase tracking-wider text-[#6B6860]">
                  Requirement Proposals ({proposals.length})
                </p>
                {proposals.length === 0 ? (
                  <p className="rounded-xl bg-[#FAF8F4] p-3 text-[#6B6860]">
                    No pending requirement proposals. Extract requirements on
                    the Brief tab to generate AI proposals.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {proposals.map((prop) => (
                      <div
                        key={prop.id}
                        className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#141413]">
                            {prop.title}
                          </span>
                          <Badge tone="warning">PROPOSAL</Badge>
                        </div>
                        {prop.description ? (
                          <p className="mt-1 text-[#57544E]">
                            {prop.description}
                          </p>
                        ) : null}
                        <div className="mt-2.5 flex gap-2">
                          <Button
                            size="sm"
                            variant="lime"
                            disabled={busyId === prop.id}
                            onClick={() =>
                              void handleProposalAction(prop.id, "ACCEPTED")
                            }
                          >
                            Accept Proposal
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === prop.id}
                            onClick={() =>
                              void handleProposalAction(prop.id, "REJECTED")
                            }
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Interactive File Preview & Review Modal */}
      <FileDetailModal
        key={selectedFileId ?? "none"}
        fileId={selectedFileId}
        projectId={projectId}
        projectSlug={projectSlug}
        isClient={isClient}
        canDownload={canDownloadFiles}
        canComment={canComment}
        onClose={() => setSelectedFileId(null)}
        onChanged={() => {
          void refreshComments();
          router.refresh();
        }}
      />
    </div>
  );
}
