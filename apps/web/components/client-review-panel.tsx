"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Badge, Card, CardTitle } from "@/components/ui";
import { Button, ErrorText, Input } from "@/components/form";

export function ClientReviewPanel({
  projectSlug,
  branchId,
  branchName,
  latestVersionId,
  latestVersionNumber,
  latestVersionLabel,
  canComment,
  canApproveVersions,
  canViewFiles,
}: {
  projectSlug: string;
  branchId: string | null;
  branchName: string | null;
  latestVersionId: string | null;
  latestVersionNumber: number | null;
  latestVersionLabel: string | null;
  canComment: boolean;
  canApproveVersions: boolean;
  canViewFiles: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submitFeedback() {
    if (!latestVersionId || !feedback.trim()) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await apiFetch("/comments", {
        method: "POST",
        body: JSON.stringify({
          versionId: latestVersionId,
          body: feedback.trim(),
        }),
      });
      setFeedback("");
      setNote("Your review feedback has been sent to the design team.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post feedback");
    } finally {
      setBusy(false);
    }
  }

  async function approveDirection() {
    if (!branchId) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await apiFetch(`/branches/${branchId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      });
      setNote(`"${branchName ?? "Branch"}" marked as APPROVED by client.`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve direction",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-[#9FE830]">
      <CardTitle
        hint={
          <div className="flex items-center gap-2">
            {latestVersionNumber ? (
              <Badge tone="violet">
                Latest Snapshot: v{latestVersionNumber}
                {latestVersionLabel ? ` · ${latestVersionLabel}` : ""}
              </Badge>
            ) : null}
            {canApproveVersions && branchId ? (
              <Button
                size="sm"
                variant="lime"
                disabled={busy}
                onClick={() => void approveDirection()}
              >
                ✓ Approve Current Direction
              </Button>
            ) : null}
          </div>
        }
      >
        Client Review & Sign-Off
      </CardTitle>

      <div className="space-y-3 text-xs">
        <p className="text-[#57544E]">
          Review the deliverable progress above, inspect the{" "}
          <Link
            href={`/p/${projectSlug}/versions`}
            className="font-semibold text-[#141413] underline"
          >
            version timeline
          </Link>
          {canViewFiles ? (
            <>
              {" "}
              or{" "}
              <Link
                href={`/p/${projectSlug}/files`}
                className="font-semibold text-[#141413] underline"
              >
                shared project files
              </Link>
            </>
          ) : null}
          , and leave your review notes below.
        </p>

        {canComment && latestVersionId ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={`Leave client feedback on v${latestVersionNumber ?? 1}…`}
              className="flex-1"
            />
            <Button
              size="sm"
              disabled={busy || !feedback.trim()}
              onClick={() => void submitFeedback()}
            >
              {busy ? "Sending…" : "Post Client Review"}
            </Button>
          </div>
        ) : null}

        {error ? <ErrorText>{error}</ErrorText> : null}
        {note ? (
          <p className="font-medium text-emerald-700">{note}</p>
        ) : null}
      </div>
    </Card>
  );
}
