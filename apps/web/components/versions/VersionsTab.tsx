"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { Badge, Card, CardTitle } from "@/components/ui";
import {
  Button,
  EmptyState,
  ErrorText,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/form";
import { Modal } from "@/components/modal";
import FileDetailModal from "@/components/files/FileDetailModal";
import MergeModal from "./MergeModal";

export interface BranchInfo {
  id: string;
  name: string;
  kind: string;
  status: string;
  parentBranchId: string | null;
  fileCount: number;
  headVersion: { id: string; number: number; label: string | null } | null;
}

export interface VersionInfo {
  id: string;
  number: number;
  label: string | null;
  note: string | null;
  createdAt: string;
  fileCount: number;
  createdBy: { id: string; name: string } | null;
  sourceBranch: { id: string; name: string; kind: string } | null;
}

interface VersionComment {
  id: string;
  body: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  convertedTaskId: string | null;
  author: { id: string; name: string } | null;
  replies?: VersionComment[];
}

interface VersionDetail {
  id: string;
  number: number;
  label: string | null;
  note: string | null;
  createdAt: string;
  checksum: string;
  branch: { id: string; name: string; kind: string; slug: string };
  createdBy: { id: string; name: string } | null;
  parentVersion: { id: string; number: number; label: string | null } | null;
  sourceBranch: { id: string; name: string; kind: string } | null;
  sourceVersion: { id: string; number: number; label: string | null } | null;
  files: Array<{
    id: string;
    path: string;
    role: string;
    file: {
      id: string;
      fileName: string;
      extension: string;
      sizeBytes: string | number;
      kind: string;
    };
  }>;
}

const KIND_TONE: Record<string, "neutral" | "success" | "warning" | "info"> = {
  MAIN: "info",
  CONCEPT: "warning",
  REVISION: "success",
  EXPERIMENTAL: "neutral",
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "info"> =
  {
    ACTIVE: "neutral",
    APPROVED: "success",
    MERGED: "info",
    ABANDONED: "warning",
  };

const KIND_OPTIONS = [
  { value: "CONCEPT", label: "Concept — explore a direction" },
  { value: "REVISION", label: "Revision — client feedback round" },
  { value: "EXPERIMENTAL", label: "Experimental — safe to break things" },
];

export default function VersionsTab({
  projectId,
  projectSlug,
  initialBranches,
  defaultBranchId,
  initialVersions,
  isClient = false,
  canApproveVersions = true,
  canComment = true,
  canDownload = true,
}: {
  projectId: string;
  projectSlug: string;
  initialBranches: BranchInfo[];
  defaultBranchId: string | null;
  initialVersions: VersionInfo[];
  isClient?: boolean;
  canApproveVersions?: boolean;
  canComment?: boolean;
  canDownload?: boolean;
}) {
  const router = useRouter();
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  const [branches, setBranches] = useState<BranchInfo[]>(initialBranches);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(
    defaultBranchId,
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    defaultBranchId ?? initialBranches[0]?.id ?? null,
  );
  const [versions, setVersions] = useState<VersionInfo[]>(initialVersions);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comments, setComments] = useState<VersionComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState(false);

  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: "",
    kind: "CONCEPT",
    fromBranchId: defaultBranchId ?? "",
  });
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshot, setSnapshot] = useState({ label: "", note: "" });
  const [renaming, setRenaming] = useState<BranchInfo | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [merging, setMerging] = useState<BranchInfo | null>(null);

  const selectedBranch =
    branches.find((branch) => branch.id === selectedBranchId) ?? null;
  const mainBranch = branches.find((branch) => branch.kind === "MAIN") ?? null;

  const refreshBranches = useCallback(async () => {
    const list = await apiFetch<BranchInfo[]>(
      `/projects/${projectId}/branches`,
    );
    setBranches(list);
    return list;
  }, [projectId]);

  const loadVersions = useCallback(async (branchId: string) => {
    setVersionsLoading(true);
    try {
      const list = await apiFetch<VersionInfo[]>(
        `/branches/${branchId}/versions`,
      );
      setVersions(list);
      setChecked(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load versions");
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  function selectBranch(branchId: string) {
    setSelectedBranchId(branchId);
    setSelectedVersionId(null);
    setDetail(null);
    setNote(null);
    setError(null);
    void loadVersions(branchId);
  }

  const loadComments = useCallback(async (versionId: string) => {
    try {
      const list = await apiFetch<VersionComment[]>(
        `/versions/${versionId}/comments`,
      );
      setComments(list);
    } catch {
      setComments([]);
    }
  }, []);

  useEffect(() => {
    if (!selectedVersionId) return;
    let cancelled = false;
    setDetailLoading(true);
    setConfirmingRestore(false);
    Promise.all([
      apiFetch<VersionDetail>(`/versions/${selectedVersionId}`),
      apiFetch<VersionComment[]>(`/versions/${selectedVersionId}/comments`).catch(
        () => [],
      ),
    ])
      .then(([res, commentList]) => {
        if (!cancelled) {
          setDetail(res);
          setComments(commentList);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load version",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVersionId]);

  async function postComment() {
    if (!selectedVersionId || !commentBody.trim()) return;
    await withAction(async () => {
      await apiFetch(`/comments`, {
        method: "POST",
        body: JSON.stringify({
          versionId: selectedVersionId,
          body: commentBody.trim(),
        }),
      });
      setCommentBody("");
      await loadComments(selectedVersionId);
      setNote("Comment posted.");
    });
  }

  async function resolveComment(commentId: string) {
    if (!selectedVersionId) return;
    await withAction(async () => {
      await apiFetch(`/comments/${commentId}/resolve`, { method: "POST" });
      await loadComments(selectedVersionId);
      setNote("Comment resolved.");
    });
  }

  async function convertCommentToTask(commentId: string) {
    if (!selectedVersionId) return;
    await withAction(async () => {
      await apiFetch(`/comments/${commentId}/convert-to-task`, {
        method: "POST",
      });
      await loadComments(selectedVersionId);
      setNote("Comment converted into a task on the Tasks board.");
    });
  }

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) next.delete(Array.from(next)[0]!);
        next.add(id);
      }
      return next;
    });
  }

  async function withAction(fn: () => Promise<void>, successNote?: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
      if (successNote) setNote(successNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function compareSelected() {
    const ids = Array.from(checked);
    if (ids.length !== 2) return;
    const picked = versions.filter((version) => ids.includes(version.id));
    const [a, b] = picked.sort((x, y) => x.number - y.number);
    if (!a || !b) return;
    await withAction(async () => {
      await apiFetch(`/versions/compare`, {
        method: "POST",
        body: JSON.stringify({
          baseVersionId: a.id,
          targetVersionId: b.id,
        }),
      });
      router.push(`/p/${projectSlug}/compare?base=${a.id}&target=${b.id}`);
    });
  }

  async function createBranch() {
    if (!newBranch.name.trim()) return;
    await withAction(async () => {
      const created = await apiFetch<BranchInfo>(
        `/projects/${projectId}/branches`,
        {
          method: "POST",
          body: JSON.stringify({
            name: newBranch.name.trim(),
            kind: newBranch.kind,
            ...(newBranch.fromBranchId
              ? { fromBranchId: newBranch.fromBranchId }
              : {}),
          }),
        },
      );
      await refreshBranches();
      setNewBranchOpen(false);
      setNewBranch({
        name: "",
        kind: "CONCEPT",
        fromBranchId: defaultBranchId ?? "",
      });
      selectBranch(created.id);
      setNote(`Branch "${created.name}" created.`);
    });
  }

  async function snapshotVersion() {
    if (!selectedBranch) return;
    await withAction(async () => {
      await apiFetch(`/branches/${selectedBranch.id}/versions`, {
        method: "POST",
        body: JSON.stringify({
          label: snapshot.label.trim() || null,
          note: snapshot.note.trim() || null,
        }),
      });
      setSnapshotOpen(false);
      setSnapshot({ label: "", note: "" });
      await loadVersions(selectedBranch.id);
      await refreshBranches();
      setNote("Snapshot saved.");
    });
  }

  async function renameBranch() {
    if (!renaming || !renameValue.trim()) return;
    await withAction(async () => {
      await apiFetch(`/branches/${renaming.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      await refreshBranches();
      setRenaming(null);
    });
  }

  async function setBranchStatus(branch: BranchInfo, status: string) {
    await withAction(async () => {
      await apiFetch(`/branches/${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshBranches();
    }, `Branch "${branch.name}" marked ${status.toLowerCase()}.`);
  }

  async function switchTo(branch: BranchInfo) {
    await withAction(async () => {
      await apiFetch(`/branches/${branch.id}/switch`, { method: "POST" });
      setCurrentBranchId(branch.id);
      setNote(
        `Now working on "${branch.name}" — the watcher reconciles your folder on its next sync.`,
      );
    });
  }

  async function restoreVersion() {
    if (!detail) return;
    await withAction(async () => {
      await apiFetch(`/branches/${detail.branch.id}/versions`, {
        method: "POST",
        body: JSON.stringify({ restoreFrom: detail.id }),
      });
      setConfirmingRestore(false);
      await loadVersions(detail.branch.id);
      await refreshBranches();
      setNote(`v${detail.number} restored as a new version.`);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardTitle
            hint={
              !isClient ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setNewBranchOpen(true)}
                >
                  + New branch
                </Button>
              ) : null
            }
          >
            Branches
          </CardTitle>

          <div className="space-y-2">
            {branches.map((branch) => {
              const isSelected = branch.id === selectedBranchId;
              const isCurrent = branch.id === currentBranchId;
              return (
                <div
                  key={branch.id}
                  className={cn(
                    "cursor-pointer rounded-2xl border p-3.5 transition",
                    isSelected
                      ? "border-[#141413] bg-[#FAF8F4] shadow-pill"
                      : "border-[#EBE7DF] bg-white hover:border-[#D5CFC2]",
                  )}
                  onClick={() => selectBranch(branch.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#141413]">
                      {branch.name}
                    </span>
                    <Badge tone={KIND_TONE[branch.kind] ?? "neutral"}>
                      {branch.kind}
                    </Badge>
                    {branch.status !== "ACTIVE" ? (
                      <Badge tone={STATUS_TONE[branch.status] ?? "neutral"}>
                        {branch.status}
                      </Badge>
                    ) : null}
                    {isCurrent ? (
                      <Badge tone="lime">current</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#6B6860]">
                    {branch.fileCount} file{branch.fileCount === 1 ? "" : "s"}
                    {branch.headVersion
                      ? ` · v${branch.headVersion.number}`
                      : " · no versions yet"}
                    {branch.parentBranchId
                      ? (() => {
                          const parent = branches.find(
                            (b) => b.id === branch.parentBranchId,
                          );
                          return parent ? ` · from ${parent.name}` : "";
                        })()
                      : ""}
                  </p>

                  {isSelected ? (
                    <div
                      className="mt-2 flex flex-wrap gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {isClient ? (
                        canApproveVersions && branch.status !== "APPROVED" ? (
                          <Button
                            size="sm"
                            variant="lime"
                            disabled={busy}
                            onClick={() =>
                              void setBranchStatus(branch, "APPROVED")
                            }
                          >
                            ✓ Approve Direction
                          </Button>
                        ) : null
                      ) : (
                        <>
                          {!isCurrent ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void switchTo(branch)}
                            >
                              Switch to
                            </Button>
                          ) : null}
                          {branch.kind !== "MAIN" &&
                          branch.status !== "MERGED" &&
                          branch.status !== "ABANDONED" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => setMerging(branch)}
                            >
                              Adopt into {mainBranch?.name ?? "Main"}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              setRenaming(branch);
                              setRenameValue(branch.name);
                            }}
                          >
                            Rename
                          </Button>
                          {branch.kind !== "MAIN" ? (
                            branch.status === "ABANDONED" ||
                            branch.status === "MERGED" ||
                            branch.status === "APPROVED" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  void setBranchStatus(branch, "ACTIVE")
                                }
                              >
                                Reopen
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() =>
                                    void setBranchStatus(branch, "APPROVED")
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-600"
                                  disabled={busy}
                                  onClick={() =>
                                    void setBranchStatus(branch, "ABANDONED")
                                  }
                                >
                                  Abandon
                                </Button>
                              </>
                            )
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle
              hint={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={checked.size !== 2 || busy}
                    onClick={() => void compareSelected()}
                  >
                    Compare selected ({checked.size})
                  </Button>
                  {!isClient ? (
                    <Button
                      size="sm"
                      disabled={!selectedBranch || busy}
                      onClick={() => setSnapshotOpen(true)}
                    >
                      Snapshot current state
                    </Button>
                  ) : null}
                </div>
              }
            >
              Versions
              {selectedBranch ? ` — ${selectedBranch.name}` : ""}
            </CardTitle>

            {versionsLoading ? (
              <p className="py-4 text-sm text-neutral-500">Loading…</p>
            ) : versions.length === 0 ? (
              <EmptyState
                title="No versions yet"
                description="Snapshot the current state to freeze a checkpoint of this branch."
              />
            ) : (
              <ul className="divide-y divide-[#F4F2ED]">
                {versions.map((version) => (
                  <li key={version.id}>
                    <div
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-3 transition hover:bg-[#FAF8F4]",
                        version.id === selectedVersionId && "bg-[#FAF8F4]",
                      )}
                      onClick={() => setSelectedVersionId(version.id)}
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(version.id)}
                        onChange={() => toggleChecked(version.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 accent-[#141413]"
                      />
                      <span className="inline-flex h-8 w-10 shrink-0 items-center justify-center rounded-xl bg-[#141413] font-mono text-xs font-semibold text-white">
                        v{version.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#141413]">
                          {version.label ?? "Untitled snapshot"}
                        </span>
                        <span className="block truncate text-xs text-[#6B6860]">
                          {version.fileCount} file
                          {version.fileCount === 1 ? "" : "s"} ·{" "}
                          {timeAgo(version.createdAt)}
                          {version.createdBy
                            ? ` · ${version.createdBy.name}`
                            : ""}
                          {version.sourceBranch
                            ? ` · adopted from ${version.sourceBranch.name}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-[#9A968C]">›</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {selectedVersionId ? (
            <Card>
              <CardTitle>Version detail</CardTitle>
              {detailLoading ? (
                <p className="py-4 text-sm text-neutral-500">Loading…</p>
              ) : !detail ? null : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      v{detail.number}
                    </span>
                    <span className="font-medium text-neutral-800">
                      {detail.label ?? "Untitled snapshot"}
                    </span>
                    {detail.sourceBranch ? (
                      <Badge tone="info">
                        adopted from {detail.sourceBranch.name}
                        {detail.sourceVersion
                          ? ` v${detail.sourceVersion.number}`
                          : ""}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {detail.branch.name} · {formatDateTime(detail.createdAt)}
                    {detail.createdBy ? ` · ${detail.createdBy.name}` : ""}
                    {detail.parentVersion
                      ? ` · parent v${detail.parentVersion.number}`
                      : ""}
                  </p>
                  {detail.note ? (
                    <p className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
                      {detail.note}
                    </p>
                  ) : null}

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6B6860]">
                      Snapshot Files ({detail.files.length}) · click to preview
                      &amp; review
                    </p>
                    {detail.files.length === 0 ? (
                      <p className="text-sm text-neutral-500">
                        No files in this snapshot.
                      </p>
                    ) : (
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {detail.files.map((versionFile) => (
                          <button
                            key={versionFile.id}
                            type="button"
                            onClick={() =>
                              setPreviewFileId(versionFile.file.id)
                            }
                            className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-2.5 text-left text-xs transition hover:border-[#141413]/30 hover:bg-white"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/v1/files/${versionFile.file.id}/preview`}
                                alt={versionFile.file.fileName}
                                className="h-10 w-10 shrink-0 rounded-xl border border-[#EBE7DF] bg-[#141413] object-cover"
                              />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-[#141413]">
                                  {versionFile.file.fileName}
                                </span>
                                <span className="block truncate font-mono text-[11px] text-[#6B6860]">
                                  {versionFile.path}
                                </span>
                              </span>
                            </div>
                            <Badge tone="neutral">{versionFile.role}</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isClient ? (
                    <div className="flex items-center gap-2">
                      {confirmingRestore ? (
                        <>
                          <span className="text-sm text-rose-600">
                            Restore as new version?
                          </span>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void restoreVersion()}
                          >
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmingRestore(false)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => setConfirmingRestore(true)}
                        >
                          Restore as new version
                        </Button>
                      )}
                    </div>
                  ) : null}

                   {/* Version Review Comments Thread */}
                   <div className="border-t border-[#EFECE6] pt-4">
                     <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B6860]">
                       Review Feedback & Comments ({comments.length})
                     </p>
                     {comments.length === 0 ? (
                       <p className="mb-3 text-xs text-[#6B6860]">
                         No feedback on this snapshot yet. Leave a review note
                         below.
                       </p>
                     ) : (
                       <ul className="mb-3 space-y-2">
                         {comments.map((comment) => (
                           <li
                             key={comment.id}
                             className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3 text-xs"
                           >
                             <div className="flex flex-wrap items-center justify-between gap-2">
                               <div className="flex items-center gap-2">
                                 <span className="font-semibold text-[#141413]">
                                   {comment.author?.name ?? "Reviewer"}
                                 </span>
                                 <span className="text-[#9A968C]">
                                   {timeAgo(comment.createdAt)}
                                 </span>
                                 <Badge
                                   tone={
                                     comment.status === "RESOLVED"
                                       ? "lime"
                                       : "warning"
                                   }
                                 >
                                   {comment.status}
                                 </Badge>
                                 {comment.convertedTaskId ? (
                                   <Badge tone="violet">Task created</Badge>
                                 ) : null}
                               </div>
                               <div className="flex items-center gap-1.5">
                                 {!comment.convertedTaskId ? (
                                   <Button
                                     size="sm"
                                     variant="secondary"
                                     disabled={busy}
                                     onClick={() =>
                                       void convertCommentToTask(comment.id)
                                     }
                                   >
                                     → Convert to Task
                                   </Button>
                                 ) : null}
                                 {comment.status !== "RESOLVED" ? (
                                   <Button
                                     size="sm"
                                     variant="ghost"
                                     disabled={busy}
                                     onClick={() =>
                                       void resolveComment(comment.id)
                                     }
                                   >
                                     Resolve
                                   </Button>
                                 ) : null}
                               </div>
                             </div>
                             <p className="mt-1.5 leading-relaxed text-[#141413]">
                               {comment.body}
                             </p>
                           </li>
                         ))}
                       </ul>
                     )}
                     <div className="flex items-center gap-2">
                       <Input
                         value={commentBody}
                         onChange={(e) => setCommentBody(e.target.value)}
                         placeholder="Add client or team feedback on this snapshot…"
                       />
                       <Button
                         size="sm"
                         disabled={busy || !commentBody.trim()}
                         onClick={() => void postComment()}
                       >
                         Post
                       </Button>
                     </div>
                   </div>
                 </div>
               )}
             </Card>
          ) : null}
        </div>
      </div>

      <Modal
        open={newBranchOpen}
        onClose={() => setNewBranchOpen(false)}
        title="New branch"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setNewBranchOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void createBranch()}
              disabled={busy || !newBranch.name.trim()}
            >
              {busy ? "Creating…" : "Create branch"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input
              autoFocus
              value={newBranch.name}
              onChange={(e) =>
                setNewBranch((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. Concept A"
            />
          </Field>
          <Field label="Kind">
            <Select
              value={newBranch.kind}
              onChange={(e) =>
                setNewBranch((prev) => ({ ...prev, kind: e.target.value }))
              }
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="From branch"
            hint="Copies the source branch's latest snapshot as a starting point."
          >
            <Select
              value={newBranch.fromBranchId}
              onChange={(e) =>
                setNewBranch((prev) => ({
                  ...prev,
                  fromBranchId: e.target.value,
                }))
              }
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        title={`Snapshot "${selectedBranch?.name ?? ""}"`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setSnapshotOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={() => void snapshotVersion()} disabled={busy}>
              {busy ? "Snapshotting…" : "Create snapshot"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Label">
            <Input
              autoFocus
              value={snapshot.label}
              onChange={(e) =>
                setSnapshot((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder="e.g. Client round 2"
            />
          </Field>
          <Field label="Note" hint="What changed in this checkpoint?">
            <Textarea
              rows={3}
              value={snapshot.note}
              onChange={(e) =>
                setSnapshot((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Updated hero colors, swapped typography…"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename branch"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRenaming(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void renameBranch()}
              disabled={busy || !renameValue.trim()}
            >
              {busy ? "Saving…" : "Rename"}
            </Button>
          </>
        }
      >
        <Field label="Name">
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </Field>
      </Modal>

      <MergeModal
        projectId={projectId}
        sourceBranch={merging}
        targetBranchName={mainBranch?.name ?? "Main"}
        open={merging !== null}
        onClose={() => setMerging(null)}
        onMerged={(message) => {
          setNote(message);
          void refreshBranches();
          if (mainBranch) selectBranch(mainBranch.id);
        }}
      />

      <FileDetailModal
        key={previewFileId ?? "none"}
        fileId={previewFileId}
        projectId={projectId}
        projectSlug={projectSlug}
        isClient={isClient}
        canDownload={canDownload}
        canComment={canComment}
        onClose={() => setPreviewFileId(null)}
        onChanged={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
