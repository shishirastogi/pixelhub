"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import { pollAiJob } from "@/lib/poll";
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

export interface BrandColorItem {
  name: string;
  hex: string;
  role: string;
  tolerance: number;
}

export interface BrandFontItem {
  family: string;
  role: string;
}

export interface BrandLogoItem {
  name: string;
  variant: string;
  fileId: string;
  isCurrent: boolean;
}

export interface BrandRuleItem {
  ruleType: string;
  payload: unknown;
  severity: string;
}

export interface BrandKitInfo {
  name: string;
  guidelinesText: string | null;
  colors: BrandColorItem[];
  fonts: BrandFontItem[];
  logos: BrandLogoItem[];
  rules: BrandRuleItem[];
}

export interface BrandCheckItem {
  id: string;
  status: string;
  checkType: string;
  findings: unknown;
  resolvedAt: string | null;
  createdAt: string;
  file: { id: string; fileName: string; path: string };
}

const COLOR_ROLES = [
  "PRIMARY",
  "SECONDARY",
  "ACCENT",
  "NEUTRAL",
  "BACKGROUND",
  "TEXT",
] as const;
const FONT_ROLES = ["HEADING", "BODY", "MONO", "OTHER"] as const;
const LOGO_VARIANTS = ["PRIMARY", "MONO", "ICON", "WORDMARK"] as const;
const RULE_TYPES = [
  "MIN_CLEAR_SPACE",
  "MIN_SIZE",
  "FORBIDDEN_COLOR",
  "FORBIDDEN_FONT",
  "USAGE_NOTE",
] as const;
const SEVERITIES = ["INFO", "WARNING", "ERROR"] as const;

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  PASS: "success",
  WARNING: "warning",
  FAIL: "danger",
};

const SEVERITY_TONE: Record<string, "info" | "warning" | "danger"> = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "danger",
};

interface Finding {
  checkType?: string;
  rule?: string;
  expected?: string;
  found?: string;
  message?: string;
  severity?: string;
  deltaE?: number;
}

function parseFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Finding => Boolean(item) && typeof item === "object",
  );
}

function ruleValue(payload: unknown): string {
  if (payload && typeof payload === "object" && "value" in payload) {
    const value = (payload as { value?: unknown }).value;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

export default function BrandKitTab({
  projectId,
  initialKit,
  initialChecks,
}: {
  projectId: string;
  initialKit: BrandKitInfo;
  initialChecks: BrandCheckItem[];
}) {
  const [kit, setKit] = useState<BrandKitInfo>(initialKit);
  const [checks, setChecks] = useState<BrandCheckItem[]>(initialChecks);
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [logoNames, setLogoNames] = useState<Record<string, string>>({});
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);

  const refreshChecks = useCallback(async () => {
    const res = await apiFetch<{ items: BrandCheckItem[] }>(
      `/projects/${projectId}/brand-checks?limit=50`,
    );
    setChecks(res.items);
  }, [projectId]);

  function updateKit<K extends keyof BrandKitInfo>(
    key: K,
    value: BrandKitInfo[K],
  ) {
    setKit((prev) => ({ ...prev, [key]: value }));
  }

  async function saveKit() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await apiFetch(`/projects/${projectId}/brand-kit`, {
        method: "PUT",
        body: JSON.stringify({
          name: kit.name.trim() || "Brand Kit",
          guidelinesText: kit.guidelinesText?.trim() || null,
          colors: kit.colors.map((color) => ({
            name: color.name.trim() || "Color",
            hex: color.hex,
            role: color.role,
            tolerance: Number(color.tolerance) || 10,
          })),
          fonts: kit.fonts.map((font) => ({
            family: font.family.trim(),
            role: font.role,
          })),
          logos: kit.logos.map((logo) => ({
            name: logo.name.trim() || "Logo",
            variant: logo.variant,
            fileId: logo.fileId,
            isCurrent: logo.isCurrent,
          })),
          rules: kit.rules.map((rule) => ({
            ruleType: rule.ruleType,
            payload: { value: ruleValue(rule.payload) },
            severity: rule.severity,
          })),
        }),
      });
      setNote("Brand kit saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save brand kit");
    } finally {
      setBusy(false);
    }
  }

  async function runCheck() {
    setBusy(true);
    setError(null);
    setNote("Running brand check…");
    try {
      const { jobId } = await apiFetch<{ jobId: string }>(
        `/projects/${projectId}/brand-kit/check`,
        { method: "POST", body: JSON.stringify({}) },
      );
      const job = await pollAiJob(jobId);
      if (job.status === "SUCCEEDED") {
        await refreshChecks();
        setNote("Brand check complete.");
      } else {
        setNote(null);
        setError(job.error ?? `Brand check ${job.status.toLowerCase()}.`);
      }
    } catch (err) {
      setNote(null);
      setError(err instanceof Error ? err.message : "Brand check failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolveCheck(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/brand-checks/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshChecks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setBusy(false);
    }
  }

  async function recheckFile(check: BrandCheckItem) {
    setRecheckingId(check.id);
    setError(null);
    try {
      const { jobId } = await apiFetch<{ jobId: string }>(
        `/files/${check.file.id}/recheck-brand`,
        { method: "POST" },
      );
      const job = await pollAiJob(jobId);
      if (job.status === "SUCCEEDED") {
        await refreshChecks();
      } else {
        setError(job.error ?? `Re-check ${job.status.toLowerCase()}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-check failed");
    } finally {
      setRecheckingId(null);
    }
  }

  const visibleChecks = checks.filter(
    (check) => showResolved || !check.resolvedAt,
  );

  return (
    <div className="space-y-4">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}

      <Card>
        <CardTitle
          hint={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void runCheck()}
              >
                {busy ? "Working…" : "Run brand check"}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void saveKit()}>
                {busy ? "Saving…" : "Save brand kit"}
              </Button>
            </div>
          }
        >
          Brand kit
        </CardTitle>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kit name">
              <Input
                value={kit.name}
                onChange={(e) => updateKit("name", e.target.value)}
              />
            </Field>
            <Field
              label="Guidelines"
              hint="Free text the AI reads during brand checks."
            >
              <Textarea
                rows={2}
                value={kit.guidelinesText ?? ""}
                onChange={(e) => updateKit("guidelinesText", e.target.value)}
                placeholder="Logo needs 24px clear space, never stretch…"
              />
            </Field>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Colors
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  updateKit("colors", [
                    ...kit.colors,
                    {
                      name: "",
                      hex: "#E11D48",
                      role: "PRIMARY",
                      tolerance: 10,
                    },
                  ])
                }
              >
                + Add color
              </Button>
            </div>
            {kit.colors.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No colors yet — add your palette so checks can flag off-brand
                shades.
              </p>
            ) : (
              <div className="space-y-2">
                {kit.colors.map((color, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="color"
                      value={color.hex}
                      onChange={(e) => {
                        const next = [...kit.colors];
                        next[index] = { ...color, hex: e.target.value };
                        updateKit("colors", next);
                      }}
                      className="h-9 w-10 cursor-pointer rounded border border-neutral-200"
                      aria-label="Color swatch"
                    />
                    <Input
                      value={color.hex}
                      onChange={(e) => {
                        const next = [...kit.colors];
                        next[index] = { ...color, hex: e.target.value };
                        updateKit("colors", next);
                      }}
                      className="w-28 font-mono text-xs"
                    />
                    <Input
                      value={color.name}
                      onChange={(e) => {
                        const next = [...kit.colors];
                        next[index] = { ...color, name: e.target.value };
                        updateKit("colors", next);
                      }}
                      placeholder="Name"
                      className="max-w-40"
                    />
                    <Select
                      value={color.role}
                      onChange={(e) => {
                        const next = [...kit.colors];
                        next[index] = { ...color, role: e.target.value };
                        updateKit("colors", next);
                      }}
                      className="w-36"
                    >
                      {COLOR_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      value={color.tolerance}
                      onChange={(e) => {
                        const next = [...kit.colors];
                        next[index] = {
                          ...color,
                          tolerance: Number(e.target.value),
                        };
                        updateKit("colors", next);
                      }}
                      title="ΔE tolerance"
                      className="w-20"
                    />
                    <Button
                      variant="ghost"
                      className="text-neutral-400"
                      aria-label="Remove color"
                      onClick={() =>
                        updateKit(
                          "colors",
                          kit.colors.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Fonts
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  updateKit("fonts", [
                    ...kit.fonts,
                    { family: "", role: "HEADING" },
                  ])
                }
              >
                + Add font
              </Button>
            </div>
            {kit.fonts.length === 0 ? (
              <p className="text-sm text-neutral-500">No fonts yet.</p>
            ) : (
              <div className="space-y-2">
                {kit.fonts.map((font, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Input
                      value={font.family}
                      onChange={(e) => {
                        const next = [...kit.fonts];
                        next[index] = { ...font, family: e.target.value };
                        updateKit("fonts", next);
                      }}
                      placeholder="e.g. Inter"
                      className="max-w-52"
                    />
                    <Select
                      value={font.role}
                      onChange={(e) => {
                        const next = [...kit.fonts];
                        next[index] = { ...font, role: e.target.value };
                        updateKit("fonts", next);
                      }}
                      className="w-36"
                    >
                      {FONT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="ghost"
                      className="text-neutral-400"
                      aria-label="Remove font"
                      onClick={() =>
                        updateKit(
                          "fonts",
                          kit.fonts.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Logos
              </p>
            </div>
            {kit.logos.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No logos yet — pick a file from the project to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {kit.logos.map((logo, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Input
                      value={logo.name}
                      onChange={(e) => {
                        const next = [...kit.logos];
                        next[index] = { ...logo, name: e.target.value };
                        updateKit("logos", next);
                      }}
                      placeholder="Logo name"
                      className="max-w-40"
                    />
                    <Select
                      value={logo.variant}
                      onChange={(e) => {
                        const next = [...kit.logos];
                        next[index] = { ...logo, variant: e.target.value };
                        updateKit("logos", next);
                      }}
                      className="w-36"
                    >
                      {LOGO_VARIANTS.map((variant) => (
                        <option key={variant} value={variant}>
                          {variant}
                        </option>
                      ))}
                    </Select>
                    <span className="rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-500">
                      {logoNames[logo.fileId] ??
                        `file:${logo.fileId.slice(0, 8)}`}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <input
                          type="checkbox"
                          checked={logo.isCurrent}
                          onChange={(e) => {
                            const next = [...kit.logos];
                            next[index] = {
                              ...logo,
                              isCurrent: e.target.checked,
                            };
                            updateKit("logos", next);
                          }}
                          className="h-3.5 w-3.5 accent-[#141413]"
                        />
                      Current
                    </label>
                    <Button
                      variant="ghost"
                      className="text-neutral-400"
                      aria-label="Remove logo"
                      onClick={() =>
                        updateKit(
                          "logos",
                          kit.logos.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => setPickerFor(kit.logos.length)}
            >
              + Add logo from files
            </Button>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Rules
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  updateKit("rules", [
                    ...kit.rules,
                    {
                      ruleType: "USAGE_NOTE",
                      payload: { value: "" },
                      severity: "WARNING",
                    },
                  ])
                }
              >
                + Add rule
              </Button>
            </div>
            {kit.rules.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No rules yet — e.g. “Never place the logo on busy imagery”.
              </p>
            ) : (
              <div className="space-y-2">
                {kit.rules.map((rule, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Select
                      value={rule.ruleType}
                      onChange={(e) => {
                        const next = [...kit.rules];
                        next[index] = { ...rule, ruleType: e.target.value };
                        updateKit("rules", next);
                      }}
                      className="w-48"
                    >
                      {RULE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={ruleValue(rule.payload)}
                      onChange={(e) => {
                        const next = [...kit.rules];
                        next[index] = {
                          ...rule,
                          payload: { value: e.target.value },
                        };
                        updateKit("rules", next);
                      }}
                      placeholder={
                        rule.ruleType === "FORBIDDEN_COLOR"
                          ? "#FF0033"
                          : rule.ruleType === "FORBIDDEN_FONT"
                            ? "Comic Sans"
                            : "Rule details"
                      }
                      className="max-w-64"
                    />
                    <Select
                      value={rule.severity}
                      onChange={(e) => {
                        const next = [...kit.rules];
                        next[index] = { ...rule, severity: e.target.value };
                        updateKit("rules", next);
                      }}
                      className="w-32"
                    >
                      {SEVERITIES.map((severity) => (
                        <option key={severity} value={severity}>
                          {severity}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="ghost"
                      className="text-neutral-400"
                      aria-label="Remove rule"
                      onClick={() =>
                        updateKit(
                          "rules",
                          kit.rules.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </Card>

      <Card>
        <CardTitle
          hint={
            <label className="flex items-center gap-1.5 text-xs text-[#6B6860]">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#141413]"
              />
              Show resolved
            </label>
          }
        >
          Check results
        </CardTitle>

        {visibleChecks.length === 0 ? (
          <EmptyState
            title="No checks yet"
            description="Click “Run brand check” to scan export & deliverable files against this kit."
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {visibleChecks.map((check) => {
              const findings = parseFindings(check.findings);
              const open = expandedCheck === check.id;
              return (
                <li key={check.id} className="py-2">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => setExpandedCheck(open ? null : check.id)}
                  >
                    <Badge tone={STATUS_TONE[check.status] ?? "warning"}>
                      {check.status}
                    </Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-800">
                        {check.file.fileName}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {check.checkType} · {timeAgo(check.createdAt)}
                        {check.resolvedAt ? " · resolved" : ""}
                      </span>
                    </span>
                    <span className="text-neutral-400">{open ? "▾" : "▸"}</span>
                  </button>
                  {open ? (
                    <div className="mt-3 space-y-2 pl-1">
                      {findings.length === 0 ? (
                        <p className="text-sm text-neutral-500">
                          No findings — looks on-brand.
                        </p>
                      ) : (
                        findings.map((finding, index) => (
                          <div
                            key={index}
                            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                tone={
                                  SEVERITY_TONE[
                                    finding.severity ?? "WARNING"
                                  ] ?? "warning"
                                }
                              >
                                {finding.severity ?? "WARNING"}
                              </Badge>
                              <span className="font-medium text-neutral-800">
                                {finding.message ?? "Finding"}
                              </span>
                            </div>
                            {finding.expected || finding.found ? (
                              <p className="mt-1 text-xs text-neutral-500">
                                expected: {finding.expected ?? "—"} · found:{" "}
                                {finding.found ?? "—"}
                                {typeof finding.deltaE === "number"
                                  ? ` · ΔE ${finding.deltaE}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy || recheckingId === check.id}
                          onClick={() => void recheckFile(check)}
                        >
                          {recheckingId === check.id
                            ? "Re-checking…"
                            : "Re-check file"}
                        </Button>
                        {!check.resolvedAt ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void resolveCheck(check.id)}
                          >
                            Mark resolved
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <FilePickerModal
        projectId={projectId}
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onSelect={(file) => {
          setLogoNames((prev) => ({ ...prev, [file.id]: file.fileName }));
          setKit((prev) => ({
            ...prev,
            logos: [
              ...prev.logos,
              {
                name: file.fileName.replace(/\.[^.]+$/, ""),
                variant: "PRIMARY",
                fileId: file.id,
                isCurrent: true,
              },
            ],
          }));
        }}
      />
    </div>
  );
}
