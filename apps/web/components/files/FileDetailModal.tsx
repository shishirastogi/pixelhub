"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatBytes, formatDateTime, timeAgo } from "@/lib/utils";
import { Badge, Card } from "@/components/ui";
import { Button, ErrorText, Select } from "@/components/form";
import { Modal } from "@/components/modal";

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
  imageMeta?: { width?: number; height?: number } | null;
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

interface RequirementOption {
  id: string;
  title: string;
}

export default function FileDetailModal({
  fileId,
  projectId,
  projectSlug,
  onClose,
  onChanged,
}: {
  fileId: string | null;
  projectId: string;
  projectSlug: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [requirements, setRequirements] = useState<RequirementOption[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActionError(null);
    setConfirmingDelete(false);

    apiFetch<FileDetail>(`/files/${fileId}`)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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

    return () => {
      cancelled = true;
    };
  }, [fileId, projectId]);

  if (!fileId) return null;

  async function withAction(fn: () => Promise<void>) {
    setActionBusy(true);
    setActionError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(false);
    }
  }

  const file = detail;

  return (
    <Modal
      open={Boolean(fileId)}
      onClose={onClose}
      title={file ? file.fileName : "File"}
      width="max-w-2xl"
    >
      {loading ? (
        <p className="py-6 text-sm text-neutral-500">Loading…</p>
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : !file ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-neutral-400">Path</p>
              <p className="font-mono text-xs">{file.path}</p>
            </div>
            <div>
              <p className="text-neutral-400">Kind</p>
              <Badge>{file.kind}</Badge>
            </div>
            <div>
              <p className="text-neutral-400">Size</p>
              <p>{formatBytes(file.sizeBytes)}</p>
            </div>
            <div>
              <p className="text-neutral-400">Type</p>
              <p className="font-mono text-xs">{file.mimeType}</p>
            </div>
            <div>
              <p className="text-neutral-400">Added</p>
              <p>{formatDateTime(file.createdAt)}</p>
            </div>
            <div>
              <p className="text-neutral-400">Analyzed</p>
              <p>{file.analyzedAt ? timeAgo(file.analyzedAt) : "—"}</p>
            </div>
          </div>

          <div className="rounded-lg bg-neutral-50 p-3 text-xs">
            <p className="text-neutral-400">SHA-256</p>
            <p className="break-all font-mono text-neutral-600">
              {file.sha256}
            </p>
          </div>

          <Card>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Linked requirements
            </p>
            {(file.linkedRequirements ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">None</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(file.linkedRequirements ?? []).map((link) => (
                  <span
                    key={link.id}
                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs"
                  >
                    {link.title}
                    <span className="ml-1 text-neutral-400">
                      ({link.matchedBy.replace(/_/g, " ").toLowerCase()})
                    </span>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Select
                value={selectedRequirementId}
                onChange={(e) => setSelectedRequirementId(e.target.value)}
              >
                <option value="">Choose requirement…</option>
                {requirements.map((req) => (
                  <option key={req.id} value={req.id}>
                    {req.title}
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                disabled={!selectedRequirementId || actionBusy}
                onClick={() =>
                  withAction(async () => {
                    await apiFetch(
                      `/requirements/${selectedRequirementId}/link-file`,
                      {
                        method: "POST",
                        body: JSON.stringify({ fileId }),
                      },
                    );
                  })
                }
              >
                Link
              </Button>
            </div>
          </Card>

          <Card>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Brand check
            </p>
            {!file.latestBrandCheck ? (
              <p className="text-sm text-neutral-500">No checks yet.</p>
            ) : (
              <div className="text-sm">
                Status:{" "}
                <Badge
                  tone={
                    file.latestBrandCheck.status === "PASS"
                      ? "success"
                      : file.latestBrandCheck.status === "WARNING"
                        ? "warning"
                        : "danger"
                  }
                >
                  {file.latestBrandCheck.status}
                </Badge>{" "}
                · {timeAgo(file.latestBrandCheck.createdAt)}
              </div>
            )}
            <Button
              variant="secondary"
              className="mt-2"
              disabled={actionBusy}
              onClick={() =>
                withAction(async () => {
                  await apiFetch(`/files/${fileId}/recheck-brand`, {
                    method: "POST",
                  });
                })
              }
            >
              Re-check brand
            </Button>
          </Card>

          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              disabled={actionBusy}
              onClick={() =>
                withAction(async () => {
                  const res = await apiFetch<{ url: string }>(
                    `/files/${fileId}/download`,
                  );
                  window.open(res.url, "_blank", "noopener,noreferrer");
                })
              }
            >
              Download
            </Button>
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-rose-600">Delete this file?</span>
                <Button
                  variant="danger"
                  disabled={actionBusy}
                  onClick={() =>
                    withAction(async () => {
                      await apiFetch(`/files/${fileId}`, { method: "DELETE" });
                      onClose();
                    })
                  }
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="text-rose-600"
                disabled={actionBusy}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>

          {actionError ? <ErrorText>{actionError}</ErrorText> : null}
          <p className="text-right text-xs text-neutral-400">{projectSlug}</p>
        </div>
      )}
    </Modal>
  );
}
