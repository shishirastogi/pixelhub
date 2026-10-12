"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn, formatBytes, formatDate, timeAgo } from "@/lib/utils";
import { Badge, Card, CardTitle } from "@/components/ui";
import {
  Button,
  EmptyState,
  ErrorText,
  Input,
  Select,
} from "@/components/form";
import FileDetailModal from "./FileDetailModal";
import UploadButton from "./UploadButton";
import WatcherPill from "./WatcherPill";

export interface FileItem {
  id: string;
  path: string;
  fileName: string;
  extension: string;
  mimeType: string;
  sizeBytes: string | number;
  kind: string;
  createdAt: string;
  imageMeta?: { width?: number; height?: number } | null;
  previews?: Array<{ kind: string; storageKey: string }>;
  linkedRequirementCount?: number;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface WatcherDeviceInfo {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
}

interface FilesResponse {
  items: FileItem[];
  nextCursor: string | null;
}

const KINDS = [
  "ALL",
  "SOURCE",
  "EXPORT",
  "DELIVERABLE",
  "REFERENCE",
  "BRAND_ASSET",
  "BRIEF_DOC",
  "OTHER",
] as const;

const KIND_TONE: Record<string, "neutral" | "success" | "warning" | "info"> = {
  SOURCE: "neutral",
  EXPORT: "success",
  DELIVERABLE: "warning",
  REFERENCE: "neutral",
  BRAND_ASSET: "info",
  BRIEF_DOC: "info",
  OTHER: "neutral",
};

export default function FilesTab({
  projectId,
  projectSlug,
  initialFiles,
  initialNextCursor,
  branches,
  defaultBranchId,
  devices: initialDevices,
}: {
  projectId: string;
  projectSlug: string;
  initialFiles: FileItem[];
  initialNextCursor: string | null;
  branches: BranchOption[];
  defaultBranchId: string | null;
  devices: WatcherDeviceInfo[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [kind, setKind] = useState<string>("ALL");
  const [branchId, setBranchId] = useState<string>(defaultBranchId ?? "");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [watchers, setWatchers] = useState<WatcherDeviceInfo[]>(initialDevices);

  const fetchFiles = useCallback(
    async (opts?: { cursor?: string; append?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (kind !== "ALL") params.set("kind", kind);
        if (branchId) params.set("branchId", branchId);
        if (q) params.set("q", q);
        params.set("limit", "50");
        if (opts?.cursor) params.set("cursor", opts.cursor);

        const res = await apiFetch<FilesResponse>(
          `/projects/${projectId}/files?${params.toString()}`,
        );
        if (opts?.append) {
          setFiles((prev) => [...prev, ...res.items]);
        } else {
          setFiles(res.items);
        }
        setNextCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files");
      } finally {
        setLoading(false);
      }
    },
    [projectId, kind, branchId, q],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFiles();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchFiles]);

  async function refreshWatchers() {
    try {
      const list = await apiFetch<WatcherDeviceInfo[]>(
        `/projects/${projectId}/watchers`,
      );
      setWatchers(list);
    } catch {
      // non-blocking
    }
  }

  function handleUploaded(ids: string[]) {
    void ids;
    fetchFiles();
    router.refresh();
  }

  const [dragOver, setDragOver] = useState(false);
  const uploadRef = useRef<{
    dropFromEvent: (files: FileList) => void;
  } | null>(null);

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      // uploads go under "exports/" so the matcher can auto-link deliverables
      uploadRef.current?.dropFromEvent(event.dataTransfer.files);
    }
    setDragOver(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="Search files…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-40"
          >
            {KINDS.map((k) => (
              <option key={k} value={k === "ALL" ? "" : k}>
                {k === "ALL" ? "All kinds" : k.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-44"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <UploadButton
          ref={uploadRef}
          projectId={projectId}
          onUploaded={handleUploaded}
        />
      </div>

      <WatcherPill
        projectId={projectId}
        projectSlug={projectSlug}
        devices={watchers}
        onRefresh={refreshWatchers}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Files</CardTitle>
          <span className="text-xs text-neutral-400">
            {files.length} file{files.length === 1 ? "" : "s"}
            {loading ? " · loading…" : ""}
          </span>
        </div>

        {files.length === 0 ? (
          <EmptyState
            title="No files yet"
            description="Upload files, or pair your project folder with the watcher to auto-track them."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">Path</th>
                  <th className="px-2 py-2 font-medium">Kind</th>
                  <th className="px-2 py-2 font-medium">Size</th>
                  <th className="px-2 py-2 font-medium">Links</th>
                  <th className="px-2 py-2 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.id}
                    className={cn(
                      "border-b border-neutral-50 transition hover:bg-neutral-50",
                      "cursor-pointer",
                    )}
                    onClick={() => setSelectedId(file.id)}
                  >
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded bg-neutral-100 font-mono text-[10px] uppercase text-neutral-500">
                          {file.extension.slice(0, 4)}
                        </span>
                        <span className="font-medium text-neutral-800">
                          {file.fileName}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2 text-neutral-500">{file.path}</td>
                    <td className="px-2 py-2">
                      <Badge tone={KIND_TONE[file.kind] ?? "neutral"}>
                        {file.kind}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-neutral-500">
                      {formatBytes(file.sizeBytes)}
                    </td>
                    <td className="px-2 py-2 text-neutral-500">
                      {file.linkedRequirementCount ?? 0}
                    </td>
                    <td className="px-2 py-2 text-neutral-500">
                      {timeAgo(file.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nextCursor ? (
          <div className="mt-3 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => fetchFiles({ cursor: nextCursor, append: true })}
            >
              Load more
            </Button>
          </div>
        ) : null}
      </Card>

      <div
        className={cn(
          "rounded-xl border border-dashed px-4 py-6 text-center text-sm transition",
          dragOver
            ? "border-rose-300 bg-rose-50/50 text-rose-700"
            : "border-neutral-300 bg-white text-neutral-500",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        Drag files here, or use the Upload button. Uploaded files land in
        `exports/` so the matcher can link them to deliverables automatically.
      </div>

      <FileDetailModal
        key={selectedId ?? "none"}
        fileId={selectedId}
        projectId={projectId}
        projectSlug={projectSlug}
        onClose={() => setSelectedId(null)}
        onChanged={() => {
          fetchFiles();
          router.refresh();
        }}
      />
    </div>
  );
}
