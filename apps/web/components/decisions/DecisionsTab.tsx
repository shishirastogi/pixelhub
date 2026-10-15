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

export interface DecisionItem {
  id: string;
  title: string;
  decision: string;
  reason: string;
  status: "PROPOSED" | "DECIDED" | "REVISITED" | "SUPERSEDED";
  versionId: string | null;
  designSheetItemId: string | null;
  decidedAt: string | null;
  createdAt: string;
  decidedBy?: { id: string; name: string } | null;
  version?: { id: string; number: number; label: string | null } | null;
}

export interface VersionOption {
  id: string;
  number: number;
  label: string | null;
  branchName: string;
}

const STATUSES = [
  "ALL",
  "PROPOSED",
  "DECIDED",
  "REVISITED",
  "SUPERSEDED",
] as const;

const STATUS_TONE: Record<
  DecisionItem["status"],
  "warning" | "lime" | "info" | "neutral"
> = {
  PROPOSED: "warning",
  DECIDED: "lime",
  REVISITED: "info",
  SUPERSEDED: "neutral",
};

export default function DecisionsTab({
  projectId,
  initialDecisions,
  versions,
}: {
  projectId: string;
  initialDecisions: DecisionItem[];
  versions: VersionOption[];
}) {
  const [decisions, setDecisions] = useState<DecisionItem[]>(initialDecisions);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DecisionItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    title: "",
    decision: "",
    reason: "",
    status: "DECIDED" as DecisionItem["status"],
    versionId: "",
  });

  const refresh = useCallback(async () => {
    const list = await apiFetch<DecisionItem[]>(
      `/projects/${projectId}/decisions`,
    );
    setDecisions(list);
  }, [projectId]);

  function openNew() {
    setEditing(null);
    setDraft({
      title: "",
      decision: "",
      reason: "",
      status: "DECIDED",
      versionId: versions[0]?.id ?? "",
    });
    setModalOpen(true);
  }

  function openEdit(item: DecisionItem) {
    setEditing(item);
    setDraft({
      title: item.title,
      decision: item.decision,
      reason: item.reason,
      status: item.status,
      versionId: item.versionId ?? "",
    });
    setModalOpen(true);
  }

  async function saveDecision() {
    if (!draft.title.trim() || !draft.decision.trim() || !draft.reason.trim()) {
      setError("Title, decision, and rationale are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const payload = {
        title: draft.title.trim(),
        decision: draft.decision.trim(),
        reason: draft.reason.trim(),
        status: draft.status,
        versionId: draft.versionId || null,
      };
      if (editing) {
        await apiFetch(`/decisions/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNote("Decision updated.");
      } else {
        await apiFetch(`/projects/${projectId}/decisions`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNote("Decision recorded in log.");
      }
      setModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save decision");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(
    item: DecisionItem,
    status: DecisionItem["status"],
  ) {
    setBusyId(item.id);
    setError(null);
    setNote(null);
    try {
      await apiFetch(`/decisions/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
      setNote(`"${item.title}" marked ${status.toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  }

  const counts = {
    ALL: decisions.length,
    PROPOSED: decisions.filter((d) => d.status === "PROPOSED").length,
    DECIDED: decisions.filter((d) => d.status === "DECIDED").length,
    REVISITED: decisions.filter((d) => d.status === "REVISITED").length,
    SUPERSEDED: decisions.filter((d) => d.status === "SUPERSEDED").length,
  };

  const visible = decisions.filter((d) =>
    filter === "ALL" ? true : d.status === filter,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle
          hint={
            <Button size="sm" onClick={openNew}>
              + Record decision
            </Button>
          }
        >
          Creative Decision Log
        </CardTitle>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                filter === s
                  ? "border-[#141413] bg-[#141413] text-white shadow-pill"
                  : "border-[#EBE7DF] bg-[#FAF8F4] text-[#57544E] hover:bg-[#F3F1EC]",
              )}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}{" "}
              <span className="ml-1 opacity-75">{counts[s]}</span>
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-3">
            <ErrorText>{error}</ErrorText>
          </div>
        ) : null}
        {note ? (
          <p className="mb-3 text-xs font-medium text-emerald-700">{note}</p>
        ) : null}

        {visible.length === 0 ? (
          <EmptyState
            title="No decisions recorded yet"
            description="Document key creative and client approvals so your team always knows why a direction was chosen."
          />
        ) : (
          <div className="space-y-3">
            {visible.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4]/70 p-4 transition hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold",
                          item.status === "DECIDED"
                            ? "bg-[#9FE830] text-[#141413]"
                            : "bg-[#EFECE6] text-[#6B6860]",
                        )}
                      >
                        {item.status === "DECIDED" ? "✓" : "•"}
                      </span>
                      <h4 className="font-semibold text-[#141413]">
                        {item.title}
                      </h4>
                      <Badge tone={STATUS_TONE[item.status]}>
                        {item.status}
                      </Badge>
                      {item.version ? (
                        <Badge tone="violet">
                          v{item.version.number}
                          {item.version.label ? ` · ${item.version.label}` : ""}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-[#6B6860]">
                      Recorded {timeAgo(item.createdAt)}
                      {item.decidedBy ? ` · by ${item.decidedBy.name}` : ""}
                      {item.decidedAt
                        ? ` · decided ${formatDate(item.decidedAt)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.status === "PROPOSED" ? (
                      <Button
                        size="sm"
                        variant="lime"
                        disabled={busyId === item.id}
                        onClick={() => void setStatus(item, "DECIDED")}
                      >
                        Approve & Decide
                      </Button>
                    ) : null}
                    {item.status === "DECIDED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === item.id}
                        onClick={() => void setStatus(item, "SUPERSEDED")}
                      >
                        Mark superseded
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === item.id}
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 border-t border-[#EFECE6] pt-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#6B6860]">
                      Decision
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#141413]">
                      {item.decision}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#6B6860]">
                      Rationale / Client Context
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#57544E]">
                      {item.reason}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Decision" : "Record Creative Decision"}
        width="max-w-xl"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveDecision()} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Record decision"}
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
              placeholder="e.g. Shift hero banner to cooler editorial gradient"
            />
          </Field>
          <Field label="Decision">
            <Textarea
              rows={3}
              value={draft.decision}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, decision: e.target.value }))
              }
              placeholder="What was decided?"
            />
          </Field>
          <Field label="Rationale">
            <Textarea
              rows={3}
              value={draft.reason}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="Why was this decision made (client feedback, brand QA, testing)?"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={draft.status}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    status: e.target.value as DecisionItem["status"],
                  }))
                }
              >
                <option value="PROPOSED">PROPOSED</option>
                <option value="DECIDED">DECIDED</option>
                <option value="REVISITED">REVISITED</option>
                <option value="SUPERSEDED">SUPERSEDED</option>
              </Select>
            </Field>
            <Field label="Pinned Version (Optional)">
              <Select
                value={draft.versionId}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, versionId: e.target.value }))
                }
              >
                <option value="">None</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.branchName} · v{v.number}
                    {v.label ? ` (${v.label})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
