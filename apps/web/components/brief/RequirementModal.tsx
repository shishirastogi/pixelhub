"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Button,
  ErrorText,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/form";
import { Modal } from "@/components/modal";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

interface DeliverableDraft {
  name: string;
  filePattern: string;
}

export interface RequirementFormValues {
  id?: string;
  title: string;
  description: string | null;
  quantity: number;
  dueDate: string | null;
  priority: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function RequirementModal({
  open,
  onClose,
  projectId,
  requirement,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  requirement: RequirementFormValues | null;
  onSaved: () => void;
}) {
  const editing = Boolean(requirement?.id);
  const [title, setTitle] = useState(requirement?.title ?? "");
  const [description, setDescription] = useState(
    requirement?.description ?? "",
  );
  const [quantity, setQuantity] = useState(requirement?.quantity ?? 1);
  const [due, setDue] = useState(toLocalInput(requirement?.dueDate ?? null));
  const [priority, setPriority] = useState(requirement?.priority ?? "MEDIUM");
  const [deliverables, setDeliverables] = useState<DeliverableDraft[]>([
    { name: "", filePattern: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDeliverable(index: number, patch: Partial<DeliverableDraft>) {
    setDeliverables((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function submit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        quantity: Number(quantity) || 1,
        dueDate: due ? new Date(due).toISOString() : null,
        priority,
      };

      if (requirement?.id) {
        await apiFetch(`/requirements/${requirement.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const deliverablePayload = deliverables
          .filter((row) => row.name.trim() && row.filePattern.trim())
          .map((row) => ({
            name: row.name.trim(),
            filePattern: row.filePattern.trim(),
          }));
        await apiFetch(`/projects/${projectId}/requirements`, {
          method: "POST",
          body: JSON.stringify({ ...body, deliverables: deliverablePayload }),
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save requirement",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit requirement" : "Add requirement"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add requirement"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Instagram launch assets"
          />
        </Field>

        <Field label="Description" hint="What does this requirement mean?">
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="3 posts for the launch week: teaser, feature, CTA…"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity">
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Field>
          <Field label="Due date">
            <Input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {!editing ? (
          <div>
            <p className="mb-1 text-sm font-medium text-neutral-700">
              Deliverables
            </p>
            <p className="mb-2 text-xs text-neutral-500">
              A deliverable is satisfied automatically when a watched/uploaded
              file matches its pattern. Example:{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5">
                instagram_post_*.png
              </code>
            </p>
            <div className="space-y-2">
              {deliverables.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      updateDeliverable(index, { name: e.target.value })
                    }
                    placeholder="Name (e.g. Post 1)"
                  />
                  <Input
                    value={row.filePattern}
                    onChange={(e) =>
                      updateDeliverable(index, { filePattern: e.target.value })
                    }
                    placeholder="File pattern (e.g. instagram_post_01.png)"
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="ghost"
                    className="shrink-0 text-neutral-400"
                    aria-label="Remove deliverable"
                    onClick={() =>
                      setDeliverables((prev) =>
                        prev.length === 1
                          ? [{ name: "", filePattern: "" }]
                          : prev.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() =>
                setDeliverables((prev) => [
                  ...prev,
                  { name: "", filePattern: "" },
                ])
              }
            >
              + Add deliverable
            </Button>
          </div>
        ) : null}

        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    </Modal>
  );
}
