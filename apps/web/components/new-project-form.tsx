"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

interface CreatedProject {
  slug: string;
}

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [briefText, setBriefText] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [createExperimentalBranch, setCreateExperimentalBranch] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const project = await apiFetch<CreatedProject>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          clientName: clientName || undefined,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          briefText: briefText || undefined,
          aiEnabled,
          createExperimentalBranch,
        }),
      });
      router.push(`/p/${project.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="name">
          Project name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Acme Q4 Campaign"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-rose-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="client">
            Client
          </label>
          <input
            id="client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Corp"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-rose-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="deadline">
            Deadline
          </label>
          <input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-rose-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="brief">
          Brief (optional)
        </label>
        <textarea
          id="brief"
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          rows={6}
          placeholder="Paste the client brief here — you can extract requirements with AI later."
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-rose-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={aiEnabled}
          onChange={(e) => setAiEnabled(e.target.checked)}
        />
        Enable AI features
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={createExperimentalBranch}
          onChange={(e) => setCreateExperimentalBranch(e.target.checked)}
        />
        Create an “Experimental” branch
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
