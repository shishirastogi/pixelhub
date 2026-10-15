"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn, formatDate, timeAgo } from "@/lib/utils";
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

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source: string;
  dueDate: string | null;
  createdAt: string;
  checklistJson: unknown;
  requirement: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
}

export interface RequirementOption {
  id: string;
  title: string;
}

const STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "info"> =
  {
    TODO: "neutral",
    IN_PROGRESS: "warning",
    DONE: "success",
    CANCELLED: "info",
  };

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  AI_EXTRACTED: "AI",
  AI_RECOMMENDATION: "AI",
  COMMENT: "From comment",
};

function checklistOf(value: unknown): Array<{ text: string; done: boolean }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { text: item, done: false };
      if (item && typeof item === "object" && "text" in item) {
        const text = (item as { text?: unknown }).text;
        const done = (item as { done?: unknown }).done;
        if (typeof text === "string") {
          return { text, done: done === true };
        }
      }
      return null;
    })
    .filter((item): item is { text: string; done: boolean } => item !== null);
}

export default function TasksTab({
  projectId,
  initialTasks,
  requirements,
}: {
  projectId: string;
  initialTasks: TaskItem[];
  requirements: RequirementOption[];
}) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [filter, setFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    requirementId: "",
    due: "",
  });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const list = await apiFetch<TaskItem[]>(`/projects/${projectId}/tasks`);
    setTasks(list);
  }, [projectId]);

  async function updateChecklist(
    task: TaskItem,
    checklist: Array<{ text: string; done: boolean }>,
  ) {
    setBusyId(task.id);
    setError(null);
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ checklist }),
      });
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update checklist",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(task: TaskItem, status: string) {
    setBusyId(task.id);
    setError(null);
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
      setNote(
        `"${task.title}" moved to ${(STATUS_LABEL[status] ?? status).toLowerCase()}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setBusyId(null);
    }
  }

  async function createTask() {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          requirementId: draft.requirementId || null,
          dueDate: draft.due ? new Date(draft.due).toISOString() : null,
        }),
      });
      setModalOpen(false);
      setDraft({ title: "", description: "", requirementId: "", due: "" });
      await refresh();
      setNote("Task created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  const active = tasks.filter((task) => task.status !== "CANCELLED");
  const counts: Record<string, number> = {
    ALL: active.length,
    TODO: active.filter((t) => t.status === "TODO").length,
    IN_PROGRESS: active.filter((t) => t.status === "IN_PROGRESS").length,
    DONE: active.filter((t) => t.status === "DONE").length,
    CANCELLED: tasks.filter((t) => t.status === "CANCELLED").length,
  };

  const columns = ["TODO", "IN_PROGRESS", "DONE"] as const;
  const showBoard =
    filter === "ALL" ||
    filter === "TODO" ||
    filter === "IN_PROGRESS" ||
    filter === "DONE";

  const visible = tasks.filter((task) => {
    if (filter === "ALL") return task.status !== "CANCELLED";
    return task.status === filter;
  });

  const FILTERS = ["ALL", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle
          hint={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              + New task
            </Button>
          }
        >
          Tasks
        </CardTitle>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                filter === f
                  ? "border-[#141413] bg-[#141413] text-white shadow-pill"
                  : "border-[#EBE7DF] bg-[#FAF8F4] text-[#57544E] hover:bg-[#F3F1EC]",
              )}
            >
              {STATUS_LABEL[f] ?? "All"} {counts[f] ?? 0}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-3">
            <ErrorText>{error}</ErrorText>
          </div>
        ) : null}
        {note ? <p className="mb-3 text-xs text-emerald-600">{note}</p> : null}

        {visible.length === 0 ? (
          <EmptyState
            title={tasks.length === 0 ? "No tasks yet" : "Nothing here"}
            description={
              tasks.length === 0
                ? "Create a task, or use “Generate tasks” on a requirement to get an AI checklist."
                : "Try another filter."
            }
          />
        ) : showBoard ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {columns.map((column) => {
              const items = tasks.filter(
                (task) =>
                  task.status === column &&
                  (filter === "ALL" || filter === column),
              );
              return (
                <div
                  key={column}
                  className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3.5"
                >
                  <p className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#57544E]">
                    {STATUS_LABEL[column]}
                    <Badge tone={column === "DONE" ? "lime" : "neutral"}>
                      {items.length}
                    </Badge>
                  </p>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="py-3 text-center text-xs text-neutral-400">
                        Empty
                      </p>
                    ) : (
                      items.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          busy={busyId === task.id}
                          onStatus={(status) => void setStatus(task, status)}
                          onChecklistChange={(next) =>
                            void updateChecklist(task, next)
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={busyId === task.id}
                onStatus={(status) => void setStatus(task, status)}
                onChecklistChange={(next) => void updateChecklist(task, next)}
              />
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New task"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void createTask()}
              disabled={saving || !draft.title.trim()}
            >
              {saving ? "Creating…" : "Create task"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title">
            <Input
              autoFocus
              value={draft.title}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="e.g. Export Instagram carousel"
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional details…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Requirement">
              <Select
                value={draft.requirementId}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    requirementId: e.target.value,
                  }))
                }
              >
                <option value="">None</option>
                {requirements.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>
                    {requirement.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date">
              <Input
                type="datetime-local"
                value={draft.due}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, due: e.target.value }))
                }
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskCard({
  task,
  busy,
  onStatus,
  onChecklistChange,
}: {
  task: TaskItem;
  busy: boolean;
  onStatus: (status: string) => void;
  onChecklistChange: (next: Array<{ text: string; done: boolean }>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newStep, setNewStep] = useState("");
  const checklist = checklistOf(task.checklistJson);
  const overdue =
    task.dueDate !== null &&
    task.status !== "DONE" &&
    task.status !== "CANCELLED" &&
    new Date(task.dueDate).getTime() < Date.now();

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="min-w-0">
          <span className="block font-medium text-neutral-800">
            {task.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <Badge tone={STATUS_TONE[task.status] ?? "neutral"}>
              {STATUS_LABEL[task.status] ?? task.status}
            </Badge>
            {task.source !== "MANUAL" ? (
              <Badge tone="info">
                {SOURCE_LABEL[task.source] ?? task.source}
              </Badge>
            ) : null}
            {task.requirement ? (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                {task.requirement.title}
              </span>
            ) : null}
            {task.dueDate ? (
              <span className={overdue ? "text-rose-600" : ""}>
                due {formatDate(task.dueDate)}
                {overdue ? " · overdue" : ""}
              </span>
            ) : null}
            <span className="text-neutral-400">{timeAgo(task.createdAt)}</span>
          </span>
        </span>
        <span className="mt-0.5 text-neutral-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
          {task.description ? (
            <p className="whitespace-pre-wrap text-xs text-neutral-600">
              {task.description}
            </p>
          ) : null}

          {checklist.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
              {checklist.map((item, index) => (
                <li key={index}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const next = checklist.map((entry, i) =>
                        i === index ? { ...entry, done: !entry.done } : entry,
                      );
                      onChecklistChange(next);
                    }}
                    className="flex w-full items-center gap-2 text-left transition hover:opacity-80"
                  >
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                        item.done
                          ? "border-[#9FE830] bg-[#9FE830] text-[#141413]"
                          : "border-[#D5CFC2] bg-white text-transparent",
                      )}
                    >
                      ✓
                    </span>
                    <span
                      className={cn(
                        item.done
                          ? "text-[#9A968C] line-through"
                          : "text-[#141413]",
                      )}
                    >
                      {item.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center gap-1.5">
            <Input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Add checklist item…"
              className="py-1.5 text-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !newStep.trim()}
              onClick={() => {
                onChecklistChange([
                  ...checklist,
                  { text: newStep.trim(), done: false },
                ]);
                setNewStep("");
              }}
            >
              + Step
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {task.status === "TODO" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onStatus("IN_PROGRESS")}
              >
                Start
              </Button>
            ) : null}
            {task.status === "IN_PROGRESS" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onStatus("TODO")}
              >
                Back to To do
              </Button>
            ) : null}
            {task.status === "TODO" || task.status === "IN_PROGRESS" ? (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => onStatus("DONE")}
                >
                  Mark done
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600"
                  disabled={busy}
                  onClick={() => onStatus("CANCELLED")}
                >
                  Cancel
                </Button>
              </>
            ) : null}
            {task.status === "DONE" || task.status === "CANCELLED" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onStatus("TODO")}
              >
                Reopen
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
