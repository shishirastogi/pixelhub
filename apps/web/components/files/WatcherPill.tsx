"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { Button, ErrorText } from "@/components/form";
import { Modal } from "@/components/modal";
import type { WatcherDeviceInfo } from "./FilesTab";

export default function WatcherPill({
  projectId,
  projectSlug,
  devices,
  onRefresh,
}: {
  projectId: string;
  projectSlug: string;
  devices: WatcherDeviceInfo[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function generateCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ code: string; expiresAt: string }>(
        `/projects/${projectId}/watchers/pair`,
        { method: "POST" },
      );
      setCode(res.code);
      setExpiresAt(res.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pair");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/watchers/${id}`, { method: "DELETE" });
      setLastResult("Device revoked.");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setLastResult("Copied to clipboard.");
    } catch {
      setLastResult(text);
    }
  }

  const lastSeen = devices
    .map((d) => (d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0))
    .reduce<number>((a, b) => Math.max(a, b), 0);

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-medium shadow-pill ${
          devices.length > 0
            ? "border-[#141413]/15 bg-[#141413] text-white"
            : "border-[#EBE7DF] bg-white text-[#6B6860]"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            devices.length > 0 ? "bg-[#9FE830]" : "bg-[#D5CFC2]"
          }`}
        />
        {devices.length > 0 ? (
          <span>
            Watching: {devices.length} device{devices.length > 1 ? "s" : ""}
            {devices[0] ? ` · ${devices[0]!.name}` : ""}
            {lastSeen > 0 ? ` · ${timeAgo(new Date(lastSeen))}` : ""}
          </span>
        ) : (
          <span>Folder Watcher Inactive — pair a folder to auto-sync</span>
        )}
      </span>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
          setLastResult(null);
        }}
      >
        {devices.length > 0 ? "Manage devices" : "Pair this folder"}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pair Local Design Folder"
        width="max-w-xl"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs leading-relaxed text-[#6B6860]">
            Run the PixelHub watcher in your local project folder. It SHA-256
            hashes new or modified exports and syncs them — matching
            deliverables automatically flip to fulfilled.
          </p>

          <div className="rounded-2xl bg-[#FAF8F4] p-4">
            <p className="mb-2 font-mono text-xs text-[#6B6860]">
              1. Install & pair agent
            </p>
            <pre className="overflow-x-auto rounded-xl bg-[#141413] p-3.5 font-mono text-xs text-white">
              {`npx pixelhub-watch pair
# server: http://localhost:3000
# paste the 8-character pairing code below`}
            </pre>
            {code ? (
              <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#141413]/15 bg-[#9FE830]/25 p-3.5">
                <span className="font-mono text-2xl font-bold tracking-[0.2em] text-[#141413]">
                  {code}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => copy(code)}
                >
                  Copy Code
                </Button>
              </div>
            ) : (
              <Button
                className="mt-3"
                size="sm"
                disabled={busy}
                onClick={generateCode}
              >
                {busy ? "Generating…" : "Generate pairing code"}
              </Button>
            )}
            {code && expiresAt ? (
              <p className="mt-2 text-xs text-[#6B6860]">
                Code expires{" "}
                {timeAgo(new Date(expiresAt)).replace("ago", "from now")}
              </p>
            ) : null}
            <p className="mt-2 font-mono text-xs text-[#6B6860]">
              2. Run <code>pixelhub-watch</code> in{" "}
              <code>{projectSlug}/</code> to begin live sync.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Paired devices
            </p>
            {devices.length === 0 ? (
              <p className="text-neutral-500">No devices paired yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {devices.map((device) => (
                  <li
                    key={device.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-xs text-neutral-400">
                        Last seen{" "}
                        {device.lastSeenAt
                          ? timeAgo(device.lastSeenAt)
                          : "never"}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => revoke(device.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? <ErrorText>{error}</ErrorText> : null}
          {lastResult ? (
            <p className="text-xs text-emerald-600">{lastResult}</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
