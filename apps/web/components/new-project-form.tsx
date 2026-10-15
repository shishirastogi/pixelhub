"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { Button, ErrorText, Field, Input, Textarea } from "@/components/form";

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
      <Field label="Project Name">
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Acme Q4 Campaign"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client">
          <Input
            id="client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Corp"
          />
        </Field>
        <Field label="Deadline">
          <Input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Client Brief (Optional)"
        hint="Paste the client brief here — you can extract requirements with AI anytime."
      >
        <Textarea
          id="brief"
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          rows={5}
          placeholder="Paste goals, deliverables, file patterns, and brand guidelines…"
        />
      </Field>

      <div className="flex flex-wrap gap-6 rounded-2xl bg-[#FAF8F4] p-4">
        <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#141413]">
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => setAiEnabled(e.target.checked)}
            className="h-4 w-4 accent-[#141413]"
          />
          <span>Enable AI assistant & extraction</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#141413]">
          <input
            type="checkbox"
            checked={createExperimentalBranch}
            onChange={(e) => setCreateExperimentalBranch(e.target.checked)}
            className="h-4 w-4 accent-[#141413]"
          />
          <span>Create an “Experimental” branch</span>
        </label>
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button type="submit" disabled={busy} className="w-full py-3">
        {busy ? "Creating Workspace…" : "Create Project Workspace →"}
      </Button>
    </form>
  );
}
