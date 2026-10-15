"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Input } from "./form";
import { Modal } from "./modal";

export interface ProjectFileOption {
  id: string;
  fileName: string;
  path: string;
  kind: string;
  extension: string;
  sizeBytes: string | number;
}

interface FilesResponse {
  items: ProjectFileOption[];
  nextCursor: string | null;
}

export function FilePickerModal({
  projectId,
  open,
  onClose,
  onSelect,
  filterKind,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (file: ProjectFileOption) => void;
  filterKind?: string;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProjectFileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (filterKind) params.set("kind", filterKind);
    if (q) params.set("q", q);
    params.set("limit", "50");

    apiFetch<FilesResponse>(`/projects/${projectId}/files?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load files");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, open, q, filterKind]);

  return (
    <Modal open={open} onClose={onClose} title="Pick a file" width="max-w-xl">
      <div className="mb-3">
        <Input
          autoFocus
          placeholder="Search files…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? (
        <p className="px-1 py-4 text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-1 py-4 text-sm text-neutral-500">No files yet.</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-auto">
          {items.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-[#EBE7DF] bg-[#FAF8F4] px-3.5 py-2.5 text-left text-xs transition hover:border-[#7C3AED] hover:bg-white"
                onClick={() => {
                  onSelect(file);
                  onClose();
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[#141413]">
                    {file.fileName}
                  </span>
                  <span className="shrink-0 text-[11px] text-[#6B6860]">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </div>
                <p className="truncate font-mono text-[11px] text-[#6B6860]">
                  {file.path}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
