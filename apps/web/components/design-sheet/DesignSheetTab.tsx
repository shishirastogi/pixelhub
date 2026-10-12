"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
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
import { FilePickerModal } from "@/components/file-picker-modal";
import { Modal } from "@/components/modal";

export interface DesignItem {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  fileId: string | null;
  boardGroup: string | null;
  linkedRequirementId: string | null;
  createdAt: string;
}

export interface RequirementOption {
  id: string;
  title: string;
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
]);

const TYPE_TONE: Record<string, "neutral" | "success" | "warning" | "info"> = {
  NOTE: "warning",
  URL: "info",
  COLOR: "success",
  IMAGE: "neutral",
  FILE_REF: "neutral",
};

export default function DesignSheetTab({
  projectId,
  projectSlug,
  initialItems,
  requirements,
}: {
  projectId: string;
  projectSlug: string;
  initialItems: DesignItem[];
  requirements: RequirementOption[];
}) {
  const [items, setItems] = useState<DesignItem[]>(initialItems);
  const [board, setBoard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalMode, setModalMode] = useState<"NOTE" | "URL" | "COLOR" | null>(
    null,
  );
  const [draft, setDraft] = useState({
    title: "",
    content: "",
    color: "#E11D48",
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(async () => {
    const list = await apiFetch<DesignItem[]>(
      `/projects/${projectId}/design-sheet`,
    );
    setItems(list);
    return list;
  }, [projectId]);

  async function createItem(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/projects/${projectId}/design-sheet`, {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          ...(board.trim() ? { boardGroup: board.trim() } : {}),
        }),
      });
      await refresh();
      setModalMode(null);
      setDraft({ title: "", content: "", color: "#E11D48" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/design-sheet/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setBusy(false);
    }
  }

  async function linkRequirement(item: DesignItem, requirementId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/design-sheet/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          linkedRequirementId: requirementId || null,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link");
    } finally {
      setBusy(false);
    }
  }

  const groups = new Map<string, DesignItem[]>();
  for (const item of items) {
    const key = item.boardGroup ?? "General";
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle
          hint={
            <span className="text-xs text-neutral-400">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          }
        >
          Design sheet — research & references
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            placeholder="Board name (e.g. Moodboard)"
            className="max-w-56"
            title="New items are added to this board"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => setModalMode("NOTE")}
          >
            + Note
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => setModalMode("URL")}
          >
            + URL
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => setModalMode("COLOR")}
          >
            + Color
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => setPickerOpen(true)}
          >
            + File from project
          </Button>
        </div>

        {error ? (
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>
        ) : null}
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="Your research board is empty"
            description="Collect references, notes, colors and project files here — then link them to requirements so decisions stay traceable."
          />
        </Card>
      ) : (
        Array.from(groups.entries()).map(([group, groupItems]) => (
          <Card key={group}>
            <CardTitle>
              {group} · {groupItems.length}
            </CardTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groupItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge tone={TYPE_TONE[item.type] ?? "neutral"}>
                        {item.type.replace(/_/g, " ")}
                      </Badge>
                      {item.title ? (
                        <span className="truncate font-medium text-neutral-800">
                          {item.title}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-neutral-400"
                      aria-label="Delete item"
                      disabled={busy}
                      onClick={() => void removeItem(item.id)}
                    >
                      ×
                    </Button>
                  </div>

                  <div className="mb-3 flex-1">
                    {item.type === "COLOR" ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="h-8 w-8 rounded border border-neutral-200"
                          style={{ backgroundColor: item.content ?? "#000" }}
                        />
                        <span className="font-mono text-xs">
                          {item.content ?? "—"}
                        </span>
                      </div>
                    ) : item.type === "URL" ? (
                      <a
                        href={item.content ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs text-sky-700 underline"
                      >
                        {item.content}
                      </a>
                    ) : item.type === "NOTE" ? (
                      <p className="whitespace-pre-wrap text-xs text-neutral-600">
                        {item.content}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        {item.fileId
                          ? `file:${item.fileId.slice(0, 8)} — open in Files`
                          : "No file attached"}
                        <span className="ml-2 text-neutral-400">
                          (#{projectSlug})
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
                    <Select
                      value={item.linkedRequirementId ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        void linkRequirement(item, e.target.value)
                      }
                      className="max-w-44 text-xs"
                      title="Link to requirement"
                    >
                      <option value="">Link requirement…</option>
                      {requirements.map((requirement) => (
                        <option key={requirement.id} value={requirement.id}>
                          {requirement.title}
                        </option>
                      ))}
                    </Select>
                    <span className="shrink-0 text-[10px] text-neutral-400">
                      {timeAgo(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      <Modal
        open={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={
          modalMode === "NOTE"
            ? "Add note"
            : modalMode === "URL"
              ? "Add URL"
              : "Add color"
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setModalMode(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                (modalMode === "NOTE" && !draft.content.trim()) ||
                (modalMode === "URL" && !draft.content.trim())
              }
              onClick={() => {
                if (modalMode === "NOTE") {
                  void createItem({
                    type: "NOTE",
                    title: draft.title.trim() || null,
                    content: draft.content.trim(),
                  });
                } else if (modalMode === "URL") {
                  void createItem({
                    type: "URL",
                    title: draft.title.trim() || null,
                    content: draft.content.trim(),
                  });
                } else if (modalMode === "COLOR") {
                  void createItem({
                    type: "COLOR",
                    title: draft.title.trim() || draft.color,
                    content: draft.color,
                  });
                }
              }}
            >
              {busy ? "Adding…" : "Add"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {modalMode !== "COLOR" ? (
            <Field label="Title">
              <Input
                autoFocus
                value={draft.title}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Optional title"
              />
            </Field>
          ) : null}

          {modalMode === "NOTE" ? (
            <Field label="Note">
              <Textarea
                rows={4}
                value={draft.content}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="Client wants a warmer palette…"
              />
            </Field>
          ) : null}

          {modalMode === "URL" ? (
            <Field label="URL" hint="Link to inspiration, references, briefs…">
              <Input
                value={draft.content}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="https://…"
              />
            </Field>
          ) : null}

          {modalMode === "COLOR" ? (
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={draft.color}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, color: e.target.value }))
                }
                className="h-10 w-14 cursor-pointer rounded border border-neutral-200"
                aria-label="Color"
              />
              <Input
                value={draft.color}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, color: e.target.value }))
                }
                className="w-32 font-mono text-xs"
              />
              <Input
                value={draft.title}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Name (optional)"
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <FilePickerModal
        projectId={projectId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(file) => {
          const extension = file.extension.toLowerCase();
          void createItem({
            type: IMAGE_EXTENSIONS.has(extension) ? "IMAGE" : "FILE_REF",
            title: file.fileName,
            fileId: file.id,
          });
        }}
      />
    </div>
  );
}
