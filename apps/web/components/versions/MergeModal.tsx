"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Button, ErrorText } from "@/components/form";
import { Modal } from "@/components/modal";

interface BranchFile {
  id: string;
  path: string;
  fileName: string;
  sizeBytes: string | number;
}

export default function MergeModal({
  projectId,
  sourceBranch,
  targetBranchName,
  open,
  onClose,
  onMerged,
}: {
  projectId: string;
  sourceBranch: { id: string; name: string } | null;
  targetBranchName: string;
  open: boolean;
  onClose: () => void;
  onMerged: (message: string) => void;
}) {
  const [files, setFiles] = useState<BranchFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sourceBranch) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFiles([]);
    setSelected(new Set());

    apiFetch<{ items: BranchFile[] }>(
      `/projects/${projectId}/files?branchId=${sourceBranch.id}&limit=100`,
    )
      .then((res) => {
        if (cancelled) return;
        setFiles(res.items);
        setSelected(new Set(res.items.map((file) => file.id)));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load files");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectId, sourceBranch]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function merge() {
    if (!sourceBranch || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const allSelected = selected.size === files.length;
      await apiFetch(`/branches/${sourceBranch.id}/merge`, {
        method: "POST",
        body: JSON.stringify(
          allSelected ? {} : { fileIds: Array.from(selected) },
        ),
      });
      onMerged(
        `Adopted ${selected.size} file${selected.size === 1 ? "" : "s"} from ${sourceBranch.name} into ${targetBranchName}.`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        sourceBranch
          ? `Adopt "${sourceBranch.name}" into ${targetBranchName}`
          : "Adopt into Main"
      }
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={merge}
            disabled={busy || loading || selected.size === 0}
          >
            {busy
              ? "Adopting…"
              : `Adopt ${selected.size} file${selected.size === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-neutral-600">
          These files from{" "}
          <span className="font-medium">{sourceBranch?.name}</span> will land on{" "}
          <span className="font-medium">{targetBranchName}</span> as a new
          version. Uncheck files you don&apos;t want to carry over.
        </p>

        {loading ? (
          <p className="py-4 text-neutral-500">Loading files…</p>
        ) : files.length === 0 ? (
          <p className="py-4 text-neutral-500">
            This branch has no files to adopt yet — upload or watch files on it
            first.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-auto">
            {files.map((file) => (
              <li key={file.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 transition hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={selected.has(file.id)}
                    onChange={() => toggle(file.id)}
                    className="h-4 w-4 accent-rose-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-neutral-800">
                      {file.fileName}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {file.path}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    </Modal>
  );
}
