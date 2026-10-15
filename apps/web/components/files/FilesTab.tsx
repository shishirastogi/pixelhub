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
  isClient = false,
  canDownload = true,
  canComment = true,
}: {
  projectId: string;
  projectSlug: string;
  initialFiles: FileItem[];
  initialNextCursor: string | null;
  branches: BranchOption[];
  defaultBranchId: string | null;
  devices: WatcherDeviceInfo[];
  isClient?: boolean;
  canDownload?: boolean;
  canComment?: boolean;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [viewMode, setViewMode] = useState<"GALLERY" | "TABLE">("GALLERY");
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
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-[#EBE7DF] bg-white p-1 shadow-pill">
            <button
              type="button"
              onClick={() => setViewMode("GALLERY")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                viewMode === "GALLERY"
                  ? "bg-[#141413] text-white"
                  : "text-[#6B6860] hover:text-[#141413]",
              )}
            >
              ⊞ Visual Gallery
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                viewMode === "TABLE"
                  ? "bg-[#141413] text-white"
                  : "text-[#6B6860] hover:text-[#141413]",
              )}
            >
              ☰ Table
            </button>
          </div>
          {!isClient ? (
            <UploadButton
              ref={uploadRef}
              projectId={projectId}
              onUploaded={handleUploaded}
            />
          ) : null}
        </div>
      </div>

      {!isClient ? (
        <WatcherPill
          projectId={projectId}
          projectSlug={projectSlug}
          devices={watchers}
          onRefresh={refreshWatchers}
        />
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>
            {isClient
              ? "Shared Project Deliverables & Assets"
              : "Tracked Project Assets"}
          </CardTitle>
          <Badge tone="neutral">
            {files.length} file{files.length === 1 ? "" : "s"} · click any asset
            to preview & review
          </Badge>
        </div>

        {files.length === 0 ? (
          <EmptyState
            title="No files in this branch yet"
            description={
              isClient
                ? "The studio has not uploaded exports to this branch yet."
                : "Upload files above, drag-and-drop exports below, or pair your local project folder with pixelhub-watch."
            }
          />
        ) : viewMode === "GALLERY" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => {
              const hasLinks = (file.linkedRequirementCount ?? 0) > 0;
              return (
                <div
                  key={file.id}
                  onClick={() => setSelectedId(file.id)}
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
                      <Badge tone={KIND_TONE[file.kind] ?? "neutral"}>
                        {file.kind}
                      </Badge>
                      {hasLinks ? (
                        <Badge tone="lime">
                          ✓ {file.linkedRequirementCount} matched
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#141413]">
                          {file.fileName}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[#6B6860]">
                          {file.path}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-[#6B6860]">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[#EBE7DF] pt-2.5 text-xs">
                      <span className="text-[#6B6860]">
                        {timeAgo(file.createdAt)}
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="rounded-xl bg-[#F4F2ED] text-[#57544E]">
                  <th className="rounded-l-xl px-3.5 py-2.5 font-medium">
                    Asset / Preview
                  </th>
                  <th className="px-3 py-2.5 font-medium">Relative Path</th>
                  <th className="px-3 py-2.5 font-medium">Status / Kind</th>
                  <th className="px-3 py-2.5 font-medium">Size</th>
                  <th className="px-3 py-2.5 font-medium">Matched Specs</th>
                  <th className="rounded-r-xl px-3.5 py-2.5 text-right font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F2ED]">
                {files.map((file) => {
                  const hasLinks = (file.linkedRequirementCount ?? 0) > 0;
                  return (
                    <tr
                      key={file.id}
                      className="cursor-pointer transition hover:bg-[#FAF8F4]"
                      onClick={() => setSelectedId(file.id)}
                    >
                      <td className="px-3.5 py-3">
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                              hasLinks
                                ? "bg-[#9FE830] text-[#141413]"
                                : "bg-[#F3F1EC] text-[#9A968C]",
                            )}
                          >
                            {hasLinks ? "✓" : "−"}
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/v1/files/${file.id}/preview`}
                            alt={file.fileName}
                            className="h-10 w-10 shrink-0 rounded-xl border border-[#EBE7DF] bg-[#141413] object-cover"
                          />
                          <span className="font-semibold text-[#141413]">
                            {file.fileName}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-[#6B6860]">
                        {file.path}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={KIND_TONE[file.kind] ?? "neutral"}>
                          {file.kind}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-medium text-[#141413]">
                        {formatBytes(file.sizeBytes)}
                      </td>
                      <td className="px-3 py-3">
                        {hasLinks ? (
                          <Badge tone="lime">
                            {file.linkedRequirementCount} linked
                          </Badge>
                        ) : (
                          <span className="text-[#9A968C]">0 linked</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-right font-semibold text-[#6D28D9]">
                        Preview & Review →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {nextCursor ? (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => fetchFiles({ cursor: nextCursor, append: true })}
            >
              Load more assets
            </Button>
          </div>
        ) : null}
      </Card>

      {!isClient ? (
        <div
          className={cn(
            "rounded-[24px] border-2 border-dashed px-6 py-8 text-center text-xs transition",
            dragOver
              ? "border-[#7C3AED] bg-[#F3EEFF] text-[#6D28D9]"
              : "border-[#DFD9CC] bg-white text-[#6B6860] hover:border-[#141413]/30",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <p className="font-serif text-lg text-[#141413]">
            Drop exports here to auto-match deliverables
          </p>
          <p className="mt-1">
            Uploaded files land in <code className="font-mono">exports/</code>{" "}
            so the deterministic glob matcher can link them to requirements
            automatically.
          </p>
        </div>
      ) : null}

      <FileDetailModal
        key={selectedId ?? "none"}
        fileId={selectedId}
        projectId={projectId}
        projectSlug={projectSlug}
        isClient={isClient}
        canDownload={canDownload}
        canComment={canComment}
        onClose={() => setSelectedId(null)}
        onChanged={() => {
          fetchFiles();
          router.refresh();
        }}
      />
    </div>
  );
}
