"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui";
import {
  Button,
  ErrorText,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/form";
import WatcherPill from "@/components/files/WatcherPill";
import type { WatcherDeviceInfo } from "@/components/files/FilesTab";

export interface ProjectSettings {
  id: string;
  name: string;
  slug: string;
  clientName: string | null;
  description: string | null;
  deadline: string | null;
  status: string;
  aiEnabled: boolean;
}

const STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function SettingsTab({
  project,
  initialDevices,
}: {
  project: ProjectSettings;
  initialDevices: WatcherDeviceInfo[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: project.name,
    clientName: project.clientName ?? "",
    description: project.description ?? "",
    deadline: toDateInput(project.deadline),
    status: project.status,
    aiEnabled: project.aiEnabled,
  });
  const [devices, setDevices] = useState<WatcherDeviceInfo[]>(initialDevices);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await apiFetch<WatcherDeviceInfo[]>(
        `/projects/${project.id}/watchers`,
      );
      setDevices(list);
    } catch {
      // non-blocking
    }
  }, [project.id]);

  async function save() {
    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await apiFetch(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          clientName: form.clientName.trim() || null,
          description: form.description.trim() || null,
          deadline: form.deadline
            ? new Date(form.deadline).toISOString()
            : null,
          status: form.status,
          aiEnabled: form.aiEnabled,
        }),
      });
      setNote("Settings saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}

      <Card>
        <CardTitle
          hint={
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save settings"}
            </Button>
          }
        >
          General
        </CardTitle>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Client">
              <Input
                value={form.clientName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, clientName: e.target.value }))
                }
                placeholder="Client name"
              />
            </Field>
            <Field label="Deadline">
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, deadline: e.target.value }))
                }
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="What is this project about?"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-[#141413]">
            <input
              type="checkbox"
              checked={form.aiEnabled}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, aiEnabled: e.target.checked }))
              }
              className="h-4 w-4 accent-[#141413]"
            />
            AI features enabled
            <span className="text-xs text-[#6B6860]">
              (requirement extraction, brand checks, comparisons)
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <CardTitle>Watcher devices</CardTitle>
        <p className="mb-3 text-sm text-neutral-500">
          Pair a local folder so files sync automatically and deliverables track
          themselves.
        </p>
        <WatcherPill
          projectId={project.id}
          projectSlug={project.slug}
          devices={devices}
          onRefresh={() => void refreshDevices()}
        />
      </Card>

      <Card className="border-rose-200">
        <CardTitle>Danger zone</CardTitle>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600">
            Archiving hides the project from your active list. You can set it
            back to active here anytime.
          </p>
          {confirmingArchive ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-rose-600">
                Archive this project?
              </span>
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => void archive()}
              >
                Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingArchive(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmingArchive(true)}
            >
              Archive project
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
