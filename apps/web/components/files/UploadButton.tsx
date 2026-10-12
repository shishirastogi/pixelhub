"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { FileKind } from "@pixelhub/types";
import { apiFetch } from "@/lib/api";
import { sha256File } from "@/lib/hash";
import { Button, ErrorText } from "@/components/form";

export interface UploadHandle {
  dropFromEvent: (files: FileList) => void;
}

interface UploadUrlResponse {
  uploadUrl: string;
  storageKey: string;
}

interface ConfirmResponse {
  id: string;
}

interface UploadProgress {
  name: string;
  status: "hashing" | "uploading" | "confirming" | "done" | "error";
  error?: string;
}

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : "";
}

interface UploadButtonProps {
  projectId: string;
  onUploaded: (ids: string[]) => void;
  pathPrefix?: string;
  kind?: FileKind;
  label?: string;
}

const UploadButton = forwardRef<UploadHandle, UploadButtonProps>(
  function UploadButton(
    { projectId, onUploaded, pathPrefix = "exports/", kind, label },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [queue, setQueue] = useState<UploadProgress[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function uploadOne(file: File): Promise<string> {
      const sha256 = await sha256File(file);

      const upload = await apiFetch<UploadUrlResponse>(
        `/projects/${projectId}/files/upload-url`,
        {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
            sha256,
          }),
        },
      );

      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!put.ok) {
        throw new Error(`Upload failed (${put.status})`);
      }

      const confirmed = await apiFetch<ConfirmResponse>(
        `/projects/${projectId}/files/confirm`,
        {
          method: "POST",
          body: JSON.stringify({
            path: `${pathPrefix}${file.name}`,
            fileName: file.name,
            extension: getExtension(file.name),
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            sha256,
            storageKey: upload.storageKey,
            ...(kind ? { kind } : {}),
          }),
        },
      );

      return confirmed.id;
    }

    async function handleFiles(fileList: FileList | File[]) {
      if (busy) return;
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setBusy(true);
      setError(null);

      const progress: UploadProgress[] = files.map((f) => ({
        name: f.name,
        status: "hashing",
      }));
      setQueue(progress);

      const ids: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]!;
        try {
          progress[i] = { name: file.name, status: "uploading" };
          setQueue([...progress]);
          const id = await uploadOne(file);
          progress[i] = { name: file.name, status: "done" };
          setQueue([...progress]);
          ids.push(id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          progress[i] = { name: file.name, status: "error", error: message };
          setQueue([...progress]);
        }
      }

      setBusy(false);
      onUploaded(ids);
      if (ids.length > 0 && queue.every((p) => p.status === "done")) {
        setQueue([]);
      }
    }

    useImperativeHandle(ref, () => ({
      dropFromEvent(files: FileList) {
        void handleFiles(files);
      },
    }));

    return (
      <div className="flex flex-col items-end gap-1">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : (label ?? "Upload files")}
        </Button>

        {queue.length > 0 ? (
          <div className="min-w-60 rounded-lg border border-neutral-200 bg-white p-2 text-xs">
            {queue.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <span className="truncate text-neutral-600">{item.name}</span>
                <span
                  className={
                    item.status === "done"
                      ? "text-emerald-600"
                      : item.status === "error"
                        ? "text-rose-600"
                        : "text-neutral-400"
                  }
                >
                  {item.status === "done"
                    ? "Done"
                    : item.status === "error"
                      ? (item.error ?? "Error")
                      : item.status}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  },
);

export default UploadButton;
