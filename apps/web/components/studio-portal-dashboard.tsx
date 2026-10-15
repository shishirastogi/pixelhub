"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn, formatDate, initials, timeAgo } from "@/lib/utils";
import {
  Badge,
  Card,
  CardTitle,
  PixelHubLogo,
  SegmentedProgress,
} from "@/components/ui";
import {
  Button,
  EmptyState,
  ErrorText,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/form";
import { LogoutButton } from "@/components/logout-button";
import { Modal } from "@/components/modal";
import { OnboardingTutorialModal } from "@/components/onboarding-tutorial-modal";
import {
  UserProfileModal,
  type UserProfileData,
} from "@/components/user-profile-modal";

export interface DashboardProjectItem {
  id: string;
  name: string;
  slug: string;
  clientName: string | null;
  description: string | null;
  deadline: string | null;
  status: string;
  role: string;
  defaultBranch: { id: string; name: string } | null;
  counts: { files: number; requirements: number; members: number };
  permissions: {
    canViewFiles: boolean;
    canDownloadFiles: boolean;
    canViewBrief: boolean;
    canComment: boolean;
    canApproveVersions: boolean;
  };
}

export interface PortalInviteItem {
  id: string;
  projectId: string;
  email: string;
  direction: "INVITE" | "REQUEST";
  role: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  message: string | null;
  canViewFiles: boolean;
  canDownloadFiles: boolean;
  canViewBrief: boolean;
  canComment: boolean;
  canApproveVersions: boolean;
  createdAt: string;
  project: {
    id: string;
    name: string;
    slug: string;
    clientName?: string | null;
    description?: string | null;
  };
  invitedBy?: {
    id: string;
    name: string;
    email: string;
    company?: string | null;
  } | null;
  user?: {
    id: string;
    name: string;
    email: string;
    company?: string | null;
    title?: string | null;
  } | null;
}

export function StudioPortalDashboard({
  user,
  projects,
  receivedInvites: initialReceived,
  sentRequests: initialSent,
  incomingRequests: initialIncoming,
}: {
  user: UserProfileData;
  projects: DashboardProjectItem[];
  receivedInvites: PortalInviteItem[];
  sentRequests: PortalInviteItem[];
  incomingRequests: PortalInviteItem[];
}) {
  const router = useRouter();
  const isClient = user.accountType === "CLIENT";

  const [profileOpen, setProfileOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromSignup =
      window.localStorage.getItem("pixelhub_show_onboarding") === "true" ||
      window.location.search.includes("welcome=1");
    if (fromSignup) {
      setTutorialOpen(true);
      window.localStorage.removeItem("pixelhub_show_onboarding");
    }
  }, []);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [slugOrId, setSlugOrId] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Designer invite draft
  const [inviteDraft, setInviteDraft] = useState({
    projectId: projects[0]?.id ?? "",
    email: "",
    role: "CLIENT",
    message: "",
    canViewFiles: true,
    canDownloadFiles: false,
    canViewBrief: true,
    canComment: true,
    canApproveVersions: true,
  });

  // Designer custom permissions when approving an incoming client request
  const [approvingRequest, setApprovingRequest] =
    useState<PortalInviteItem | null>(null);
  const [grantPerms, setGrantPerms] = useState({
    canViewFiles: true,
    canDownloadFiles: false,
    canViewBrief: true,
    canComment: true,
    canApproveVersions: true,
  });

  const pendingReceived = initialReceived.filter((i) => i.status === "PENDING");
  const totalFiles = projects.reduce((sum, p) => sum + p.counts.files, 0);
  const totalReqs = projects.reduce((sum, p) => sum + p.counts.requirements, 0);
  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;

  async function handleRequestAccess(targetSlug?: string) {
    const target = (targetSlug ?? slugOrId).trim();
    if (!target) {
      setError("Enter a project slug or select a project.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNote(null);
    try {
      await apiFetch("/invites", {
        method: "POST",
        body: JSON.stringify({
          projectSlugOrId: target,
          message:
            requestMessage.trim() ||
            `Client access requested by ${user.name} (${user.email}).`,
        }),
      });
      setNote(`Access request sent for "${target}".`);
      setRequestModalOpen(false);
      setRequestMessage("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to request project access",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRespondInvite(
    inviteId: string,
    status: "ACCEPTED" | "DECLINED",
    customPerms?: typeof grantPerms,
  ) {
    setBusyId(inviteId);
    setError(null);
    setNote(null);
    try {
      await apiFetch(`/invites/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({
          status,
          ...(customPerms ?? {}),
        }),
      });
      setApprovingRequest(null);
      setNote(
        status === "ACCEPTED"
          ? "Access granted — workspace membership is now active."
          : "Invitation / request declined.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to respond to invitation",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendDesignerInvite() {
    if (!inviteDraft.projectId || !inviteDraft.email.trim()) {
      setError("Choose a project and enter an email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNote(null);
    try {
      await apiFetch(`/projects/${inviteDraft.projectId}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteDraft.email.trim(),
          role: inviteDraft.role,
          message: inviteDraft.message.trim() || null,
          canViewFiles: inviteDraft.canViewFiles,
          canDownloadFiles: inviteDraft.canDownloadFiles,
          canViewBrief: inviteDraft.canViewBrief,
          canComment: inviteDraft.canComment,
          canApproveVersions: inviteDraft.canApproveVersions,
        }),
      });
      setInviteModalOpen(false);
      setInviteDraft((prev) => ({ ...prev, email: "", message: "" }));
      setNote(`Invitation sent to ${inviteDraft.email.trim()}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-2 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1480px] flex-col rounded-[32px] border border-white/70 bg-sidebar-warm p-2.5 shadow-shell lg:flex-row lg:p-3.5">
        {/* LEFT SIDEBAR */}
        <aside className="flex w-full shrink-0 flex-col justify-between px-2 py-2.5 lg:w-[258px] lg:pr-3.5">
          <div className="space-y-5">
            <div className="flex items-center justify-between px-2 pt-1">
              <PixelHubLogo />
              <Badge tone={isClient ? "info" : "lime"}>
                {isClient ? "Client Portal" : "Designer"}
              </Badge>
            </div>

            <div>
              <p className="mb-1.5 px-3 text-[11px] font-medium text-[#7D7970]">
                {isClient ? "Client Navigation" : "Studio Navigation"}
              </p>
              <nav className="space-y-1">
                <Link
                  href="/app"
                  className="flex items-center justify-between rounded-2xl bg-white px-3.5 py-2.5 text-xs font-semibold text-[#141413] shadow-pill"
                >
                  <span className="flex items-center gap-2.5">
                    <svg
                      viewBox="0 0 18 18"
                      fill="none"
                      className="h-4 w-4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <rect x="2.5" y="2.5" width="5.2" height="5.2" rx="1.4" />
                      <rect x="10.3" y="2.5" width="5.2" height="5.2" rx="1.4" />
                      <rect x="2.5" y="10.3" width="5.2" height="5.2" rx="1.4" />
                      <rect
                        x="10.3"
                        y="10.3"
                        width="5.2"
                        height="5.2"
                        rx="1.4"
                      />
                    </svg>
                    <span>
                      {isClient ? "Client Dashboard" : "Studio Portfolio"}
                    </span>
                  </span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#141413] px-1.5 text-[10px] font-semibold text-white">
                    {projects.length}
                  </span>
                </Link>

                {isClient ? (
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(true)}
                    className="flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs font-medium text-[#57544E] transition hover:bg-white/60 hover:text-[#141413]"
                  >
                    <span className="flex items-center gap-2.5">
                      <svg
                        viewBox="0 0 18 18"
                        fill="none"
                        className="h-4 w-4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <path
                          d="M9 3.5v11M3.5 9h11"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>Request Project Access</span>
                    </span>
                    {pendingReceived.length > 0 ? (
                      <Badge tone="lime">{pendingReceived.length}</Badge>
                    ) : null}
                  </button>
                ) : (
                  <>
                    <Link
                      href="/app/new"
                      className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-[#57544E] transition hover:bg-white/60 hover:text-[#141413]"
                    >
                      <svg
                        viewBox="0 0 18 18"
                        fill="none"
                        className="h-4 w-4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <path
                          d="M9 3.5v11M3.5 9h11"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>New Project</span>
                    </Link>
                    {projects.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setInviteModalOpen(true)}
                        className="flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs font-medium text-[#57544E] transition hover:bg-white/60 hover:text-[#141413]"
                      >
                        <span className="flex items-center gap-2.5">
                          <svg
                            viewBox="0 0 18 18"
                            fill="none"
                            className="h-4 w-4"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <rect
                              x="2.5"
                              y="4"
                              width="13"
                              height="10"
                              rx="2"
                            />
                            <path
                              d="m3.5 5.5 5.5 4 5.5-4"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span>Invite Client / Team</span>
                        </span>
                        {initialIncoming.length > 0 ? (
                          <Badge tone="lime">{initialIncoming.length}</Badge>
                        ) : null}
                      </button>
                    ) : null}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-[#57544E] transition hover:bg-white/60 hover:text-[#141413]"
                >
                  <svg
                    viewBox="0 0 18 18"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <circle cx="9" cy="6" r="2.8" />
                    <path
                      d="M3.5 15c.9-2.6 3-4 5.5-4s4.6 1.4 5.5 4"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Account Settings</span>
                </button>

                <Link
                  href="/app/help"
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-[#57544E] transition hover:bg-white/60 hover:text-[#141413]"
                >
                  <svg
                    viewBox="0 0 18 18"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <circle cx="9" cy="9" r="6.25" />
                    <path
                      d="M7.25 7.25a1.75 1.75 0 1 1 2.4 1.62c-.46.2-.65.5-.65.98v.4"
                      strokeLinecap="round"
                    />
                    <circle cx="9" cy="12.6" r="0.7" fill="currentColor" />
                  </svg>
                  <span>Help &amp; FAQ</span>
                </Link>
              </nav>
            </div>

            {projects.length > 0 ? (
              <div>
                <p className="mb-1.5 px-3 text-[11px] font-medium text-[#7D7970]">
                  {isClient ? "Shared With You" : "Your Workspaces"}
                </p>
                <div className="space-y-1">
                  {projects.slice(0, 6).map((project) => (
                    <Link
                      key={project.id}
                      href={`/p/${project.slug}`}
                      className="group flex items-center gap-3 rounded-2xl px-2.5 py-2 transition hover:bg-white/65"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#DFD9CC]/85 text-xs font-semibold text-[#141413] group-hover:bg-[#141413] group-hover:text-white">
                        {initials(project.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-[#141413]">
                          {project.name}
                        </span>
                        <span className="block truncate text-[11px] text-[#6B6860]">
                          {project.role} · {project.counts.files} files
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Real User Profile Card at Bottom of Sidebar */}
          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex w-full items-center justify-between gap-2 rounded-2xl bg-[#DCD5C6]/85 p-2.5 text-left transition hover:bg-[#D3CBB9]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#141413] text-xs font-semibold text-white">
                  {initials(user.name || user.email)}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-[#141413]">
                      {user.name}
                    </span>
                  </span>
                  <span className="block truncate text-[11px] text-[#57544E]">
                    {user.company ? `${user.company} · ` : ""}
                    {user.email}
                  </span>
                </span>
              </div>
              <span className="text-xs text-[#57544E]">✎</span>
            </button>
            <div className="flex justify-end">
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT */}
        <div className="flex flex-1 flex-col rounded-[26px] border border-white/80 bg-[#F8F6F1] p-5 sm:p-7">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-serif text-3xl font-normal tracking-[-0.01em] text-[#141413] sm:text-[34px]">
                  {isClient
                    ? "Client Review Portal"
                    : "Designer Studio Overview"}
                </h1>
                <Badge tone={isClient ? "info" : "lime"}>
                  {user.accountType}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[#6B6860]">
                {isClient
                  ? "Track project progress, accept invitations, request access, and review deliverables"
                  : "Manage creative workspaces, client invitations, access requests, and live folders"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/app/help"
                className="rounded-full border border-[#EBE7DF] bg-white px-3.5 py-1.5 text-xs font-medium text-[#141413] shadow-pill transition hover:bg-[#F3F1EC]"
              >
                Help &amp; FAQ
              </Link>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setProfileOpen(true)}
              >
                Account Settings
              </Button>
              {isClient ? (
                <Button size="sm" onClick={() => setRequestModalOpen(true)}>
                  + Request Project Access
                </Button>
              ) : (
                <>
                  {projects.length > 0 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setInviteModalOpen(true)}
                    >
                      Invite Client
                    </Button>
                  ) : null}
                  <Link
                    href="/app/new"
                    className="inline-flex items-center gap-2 rounded-full bg-[#141413] px-4 py-2 text-xs font-medium text-white shadow-pill transition hover:bg-[#2A2927]"
                  >
                    + New Project
                  </Link>
                </>
              )}
            </div>
          </header>

          {error ? (
            <div className="mb-4">
              <ErrorText>{error}</ErrorText>
            </div>
          ) : null}
          {note ? (
            <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
              {note}
            </p>
          ) : null}

          {/* PENDING INVITATIONS BANNER (Shown when user has received project invitations) */}
          {pendingReceived.length > 0 ? (
            <Card className="mb-5 border-[#9FE830] bg-gradient-to-r from-[#FAF8F4] to-white">
              <CardTitle
                hint={
                  <Badge tone="lime">
                    {pendingReceived.length} New Invitation
                    {pendingReceived.length === 1 ? "" : "s"}
                  </Badge>
                }
              >
                Project Invitations Waiting for You
              </CardTitle>

              <div className="space-y-3">
                {pendingReceived.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#EBE7DF] bg-white p-4 shadow-pill"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#141413]">
                          {inv.project.name}
                        </span>
                        <Badge tone="info">Role: {inv.role}</Badge>
                        {inv.invitedBy ? (
                          <span className="text-xs text-[#6B6860]">
                            Invited by {inv.invitedBy.name}
                          </span>
                        ) : null}
                      </div>
                      {inv.message ? (
                        <p className="text-xs text-[#57544E]">
                          “{inv.message}”
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge tone="neutral">✓ View Progress</Badge>
                        {inv.canViewBrief ? (
                          <Badge tone="neutral">✓ View Brief</Badge>
                        ) : null}
                        {inv.canViewFiles ? (
                          <Badge tone="neutral">✓ View Files</Badge>
                        ) : null}
                        {inv.canDownloadFiles ? (
                          <Badge tone="neutral">✓ Download Exports</Badge>
                        ) : null}
                        {inv.canComment ? (
                          <Badge tone="neutral">✓ Leave Reviews</Badge>
                        ) : null}
                        {inv.canApproveVersions ? (
                          <Badge tone="neutral">✓ Approve Versions</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="lime"
                        disabled={busyId === inv.id}
                        onClick={() =>
                          void handleRespondInvite(inv.id, "ACCEPTED")
                        }
                      >
                        Accept & Open Access
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === inv.id}
                        onClick={() =>
                          void handleRespondInvite(inv.id, "DECLINED")
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* DESIGNER INCOMING CLIENT ACCESS REQUESTS */}
          {!isClient && initialIncoming.length > 0 ? (
            <Card className="mb-5 border-[#7C3AED]/30">
              <CardTitle
                hint={
                  <Badge tone="violet">
                    {initialIncoming.length} Client Request
                    {initialIncoming.length === 1 ? "" : "s"}
                  </Badge>
                }
              >
                Incoming Client Access Requests
              </CardTitle>
              <div className="space-y-3">
                {initialIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#141413]">
                          {req.user?.name ?? req.email}
                        </span>
                        <span className="text-xs text-[#6B6860]">
                          ({req.email})
                        </span>
                        {req.user?.company ? (
                          <Badge tone="neutral">{req.user.company}</Badge>
                        ) : null}
                        <span className="text-xs text-[#6B6860]">
                          requested access to
                        </span>
                        <Badge tone="lime">{req.project.name}</Badge>
                      </div>
                      {req.message ? (
                        <p className="mt-1 text-xs text-[#57544E]">
                          “{req.message}”
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-[#9A968C]">
                        Requested {timeAgo(req.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="lime"
                        disabled={busyId === req.id}
                        onClick={() => {
                          setApprovingRequest(req);
                          setGrantPerms({
                            canViewFiles: req.canViewFiles,
                            canDownloadFiles: req.canDownloadFiles,
                            canViewBrief: req.canViewBrief,
                            canComment: req.canComment,
                            canApproveVersions: req.canApproveVersions,
                          });
                        }}
                      >
                        Configure & Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === req.id}
                        onClick={() =>
                          void handleRespondInvite(req.id, "DECLINED")
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* Top Bento Row: Golden Hero + Overview Card */}
          <div className="mb-5 grid gap-5 lg:grid-cols-12">
            <div className="relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[26px] bg-golden-hero p-6 shadow-card lg:col-span-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#141413] text-xs text-white">
                  ✦
                </span>
                <span className="text-xs font-medium text-[#141413]">
                  {isClient
                    ? "Client Review · Live Deliverables"
                    : "Designer Studio · Live Sync"}
                </span>
              </div>
              <div className="mt-8">
                <h2 className="font-serif text-4xl leading-[1.05] text-[#141413]">
                  {isClient ? (
                    <>
                      Review your
                      <br />
                      <span className="italic">deliverables</span>
                    </>
                  ) : (
                    <>
                      Explore your
                      <br />
                      <span className="italic">projects</span>
                    </>
                  )}
                </h2>
                <p className="mt-2 text-xs text-[#423E37]">
                  {isClient
                    ? "Inspect live project progress, leave feedback on version snapshots, and request access to studio workspaces."
                    : "Select any workspace below to inspect its Pulse, requirements, client permissions, and versions."}
                </p>
              </div>
            </div>

            <Card className="flex flex-col justify-between lg:col-span-7">
              <CardTitle
                hint={
                  <Badge tone="lime">
                    {activeCount} Active Workspace{activeCount === 1 ? "" : "s"}
                  </Badge>
                }
              >
                {isClient ? "Your Client Access Summary" : "Portfolio Pulse"}
              </CardTitle>

              <div className="grid grid-cols-3 gap-4 py-2">
                <div>
                  <p className="text-xs text-[#6B6860]">
                    {isClient ? "Shared Projects" : "Total Projects"}
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-[#141413]">
                    {projects.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B6860]">Tracked Files</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-[#6D28D9]">
                    {totalFiles}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B6860]">
                    {isClient ? "Invites / Requests" : "Requirements"}
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-[#141413]">
                    {isClient
                      ? pendingReceived.length + initialSent.length
                      : totalReqs}
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-[#F2EFE8] pt-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-[#6B6860]">Active Workspace Ratio</span>
                  <span className="font-semibold text-[#6D28D9]">
                    {projects.length > 0
                      ? Math.round((activeCount / projects.length) * 100)
                      : 100}
                    %
                  </span>
                </div>
                <SegmentedProgress
                  value={
                    projects.length > 0
                      ? Math.round((activeCount / projects.length) * 100)
                      : 100
                  }
                  segments={32}
                />
              </div>
            </Card>
          </div>

          {/* SHARED / STUDIO PROJECTS GRID */}
          <Card className="mb-5">
            <CardTitle
              hint={
                isClient ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRequestModalOpen(true)}
                  >
                    + Request Access to Another Project
                  </Button>
                ) : (
                  <span className="text-xs text-[#6B6860]">
                    Click a project to open its workspace
                  </span>
                )
              }
            >
              {isClient
                ? "Projects You Have Access To"
                : "Project Workspaces"}
            </CardTitle>

            {projects.length === 0 ? (
              <EmptyState
                title={
                  isClient
                    ? "You don't have access to any projects yet"
                    : "No projects in your studio yet"
                }
                description={
                  isClient
                    ? "Accept an invitation above, or request access to a designer's project below to view its progress, deliverables, and versions."
                    : "Create your first project to generate a Main Concept branch, Brand Kit, and live deliverable tracker."
                }
                action={
                  isClient ? (
                    <Button onClick={() => setRequestModalOpen(true)}>
                      Request Access to a Project →
                    </Button>
                  ) : (
                    <Link
                      href="/app/new"
                      className="inline-flex items-center gap-2 rounded-full bg-[#141413] px-5 py-2.5 text-xs font-medium text-white shadow-pill"
                    >
                      Create your first project →
                    </Link>
                  )
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/p/${project.slug}`}
                    className="group flex flex-col justify-between rounded-[22px] border border-[#EBE7DF] bg-[#FAF8F4] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#141413]/30 hover:bg-white hover:shadow-card"
                  >
                    <div>
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#141413] text-xs font-semibold text-white">
                            {initials(project.name)}
                          </span>
                          <div>
                            <h2 className="font-semibold text-[#141413] group-hover:text-[#6D28D9]">
                              {project.name}
                            </h2>
                            <p className="text-xs text-[#6B6860]">
                              {project.clientName ?? "Internal client"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          tone={project.role === "CLIENT" ? "info" : "lime"}
                        >
                          {project.role}
                        </Badge>
                      </div>

                      {/* Granted Permissions Chips for Client */}
                      {project.role === "CLIENT" ? (
                        <div className="mb-3 flex flex-wrap gap-1">
                          <Badge tone="neutral">Progress</Badge>
                          {project.permissions.canViewFiles ? (
                            <Badge tone="neutral">Files</Badge>
                          ) : null}
                          {project.permissions.canDownloadFiles ? (
                            <Badge tone="neutral">Download</Badge>
                          ) : null}
                          {project.permissions.canComment ? (
                            <Badge tone="neutral">Reviews</Badge>
                          ) : null}
                          {project.permissions.canApproveVersions ? (
                            <Badge tone="neutral">Approve</Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <dl className="mt-2 grid grid-cols-2 gap-2.5 rounded-2xl bg-white p-3 text-xs shadow-pill group-hover:bg-[#FAF8F4]">
                      <div>
                        <dt className="text-[#6B6860]">Deadline</dt>
                        <dd className="mt-0.5 font-medium text-[#141413]">
                          {formatDate(project.deadline)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#6B6860]">Files</dt>
                        <dd className="mt-0.5 font-semibold text-[#141413]">
                          {project.counts.files} units
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#6B6860]">Requirements</dt>
                        <dd className="mt-0.5 font-semibold text-[#6D28D9]">
                          {project.counts.requirements} specs
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#6B6860]">Team Members</dt>
                        <dd className="mt-0.5 font-medium text-[#141413]">
                          {project.counts.members} member
                          {project.counts.members === 1 ? "" : "s"}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* CLIENT ACCESS REQUEST BY SLUG & INVITATION HISTORY */}
          {isClient || initialSent.length > 0 || initialReceived.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-12">
              {isClient ? (
                <Card className="lg:col-span-7">
                  <CardTitle>Request Access by Project Slug</CardTitle>
                  <p className="mb-4 text-xs leading-relaxed text-[#6B6860]">
                    Enter the exact project slug shared by your designer to
                    request client review access. Once approved, you&apos;ll be
                    able to view project progress, inspect files, and post
                    feedback according to the permissions granted.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Input
                      value={slugOrId}
                      onChange={(e) => setSlugOrId(e.target.value)}
                      placeholder="Project slug (e.g. acme-q4-campaign)"
                    />
                    <Input
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      placeholder="Optional note to designer…"
                    />
                    <Button
                      disabled={submitting || !slugOrId.trim()}
                      onClick={() => void handleRequestAccess()}
                    >
                      {submitting ? "Sending…" : "Request Access"}
                    </Button>
                  </div>
                </Card>
              ) : null}

              {/* Sent Access Requests & Invitation History */}
              <Card className={isClient ? "lg:col-span-5" : "lg:col-span-12"}>
                <CardTitle>Your Access Requests & Invites</CardTitle>
                {initialSent.length === 0 && initialReceived.length === 0 ? (
                  <p className="text-xs text-[#6B6860]">
                    No access requests or invitations yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#F4F2ED] text-xs">
                    {[...initialReceived, ...initialSent].map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 py-2.5"
                      >
                        <div>
                          <p className="font-semibold text-[#141413]">
                            {item.project.name}
                          </p>
                          <p className="text-[11px] text-[#6B6860]">
                            {item.direction === "INVITE"
                              ? "Invited by studio"
                              : "Requested by you"}{" "}
                            · {timeAgo(item.createdAt)}
                          </p>
                        </div>
                        <Badge
                          tone={
                            item.status === "ACCEPTED"
                              ? "lime"
                              : item.status === "DECLINED"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {item.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      {/* USER PROFILE MODAL */}
      <UserProfileModal
        user={user}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      {/* INTRODUCTORY POPUP TUTORIAL MODAL */}
      <OnboardingTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        accountType={user.accountType}
        userName={user.name}
      />

      {/* CLIENT: REQUEST ACCESS TO A PROJECT MODAL */}
      <Modal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Request Access to a Project"
        width="max-w-lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRequestModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleRequestAccess()}
              disabled={submitting || !slugOrId.trim()}
            >
              {submitting ? "Sending Request…" : "Send Access Request"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-[#6B6860]">
            Enter the project slug provided by your designer. Once the designer
            approves your request, you&apos;ll be able to see project progress,
            inspect shared files, and post review feedback.
          </p>

          <Field
            label="Project Slug"
            hint="Ask your designer for the project slug (for example: acme-q4-campaign)"
          >
            <Input
              autoFocus
              value={slugOrId}
              onChange={(e) => setSlugOrId(e.target.value)}
              placeholder="e.g. acme-q4-campaign"
            />
          </Field>

          <Field label="Note to Designer (Optional)">
            <Textarea
              rows={3}
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Hi! I'd love client review access to check the deliverables and leave feedback."
            />
          </Field>
        </div>
      </Modal>

      {/* DESIGNER: INVITE CLIENT / TEAM MEMBER MODAL */}
      <Modal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Client or Team Member"
        width="max-w-lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setInviteModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSendDesignerInvite()}
              disabled={submitting || !inviteDraft.email.trim()}
            >
              {submitting ? "Sending…" : "Send Invitation"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Project Workspace">
            <Select
              value={inviteDraft.projectId}
              onChange={(e) =>
                setInviteDraft((prev) => ({
                  ...prev,
                  projectId: e.target.value,
                }))
              }
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Invitee Email">
              <Input
                type="email"
                value={inviteDraft.email}
                onChange={(e) =>
                  setInviteDraft((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="client@acme.com"
              />
            </Field>
            <Field label="Role">
              <Select
                value={inviteDraft.role}
                onChange={(e) =>
                  setInviteDraft((prev) => ({ ...prev, role: e.target.value }))
                }
              >
                <option value="CLIENT">CLIENT (Review & Progress)</option>
                <option value="REVIEWER">REVIEWER (QA & Approvals)</option>
                <option value="CONTRIBUTOR">CONTRIBUTOR (Designer)</option>
              </Select>
            </Field>
          </div>

          {inviteDraft.role === "CLIENT" ? (
            <div className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3.5">
              <p className="mb-2 text-xs font-semibold text-[#141413]">
                Client Permissions
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={inviteDraft.canViewBrief}
                    onChange={(e) =>
                      setInviteDraft((p) => ({
                        ...p,
                        canViewBrief: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[#141413]"
                  />
                  <span>View Brief & Requirements</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={inviteDraft.canViewFiles}
                    onChange={(e) =>
                      setInviteDraft((p) => ({
                        ...p,
                        canViewFiles: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[#141413]"
                  />
                  <span>View Project Files</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={inviteDraft.canDownloadFiles}
                    onChange={(e) =>
                      setInviteDraft((p) => ({
                        ...p,
                        canDownloadFiles: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[#141413]"
                  />
                  <span>Download Exports</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={inviteDraft.canComment}
                    onChange={(e) =>
                      setInviteDraft((p) => ({
                        ...p,
                        canComment: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[#141413]"
                  />
                  <span>Post Review Comments</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={inviteDraft.canApproveVersions}
                    onChange={(e) =>
                      setInviteDraft((p) => ({
                        ...p,
                        canApproveVersions: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[#141413]"
                  />
                  <span>Approve Versions</span>
                </label>
              </div>
            </div>
          ) : null}

          <Field label="Invitation Note (Optional)">
            <Textarea
              rows={2}
              value={inviteDraft.message}
              onChange={(e) =>
                setInviteDraft((prev) => ({ ...prev, message: e.target.value }))
              }
              placeholder="Here is access to track our Q4 deliverables and review snapshots."
            />
          </Field>
        </div>
      </Modal>

      {/* DESIGNER: APPROVE CLIENT ACCESS REQUEST WITH CUSTOM PERMISSIONS */}
      <Modal
        open={approvingRequest !== null}
        onClose={() => setApprovingRequest(null)}
        title="Approve Client Access Request"
        width="max-w-lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setApprovingRequest(null)}
              disabled={busyId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="lime"
              disabled={busyId !== null}
              onClick={() =>
                approvingRequest &&
                void handleRespondInvite(
                  approvingRequest.id,
                  "ACCEPTED",
                  grantPerms,
                )
              }
            >
              Grant Client Access
            </Button>
          </>
        }
      >
        {approvingRequest ? (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl bg-[#FAF8F4] p-3.5">
              <p className="font-semibold text-[#141413]">
                {approvingRequest.user?.name ?? approvingRequest.email} (
                {approvingRequest.email})
              </p>
              <p className="mt-0.5 text-[#6B6860]">
                Project: <strong>{approvingRequest.project.name}</strong>
              </p>
              {approvingRequest.message ? (
                <p className="mt-1 italic text-[#57544E]">
                  “{approvingRequest.message}”
                </p>
              ) : null}
            </div>

            <div className="space-y-2.5 rounded-2xl border border-[#EBE7DF] p-4">
              <p className="font-semibold text-[#141413]">
                Choose Permissions to Grant
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={grantPerms.canViewBrief}
                  onChange={(e) =>
                    setGrantPerms((p) => ({
                      ...p,
                      canViewBrief: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#141413]"
                />
                <span>Allow viewing Brief & Requirements progress</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={grantPerms.canViewFiles}
                  onChange={(e) =>
                    setGrantPerms((p) => ({
                      ...p,
                      canViewFiles: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#141413]"
                />
                <span>Allow viewing Project Files & Exports</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={grantPerms.canDownloadFiles}
                  onChange={(e) =>
                    setGrantPerms((p) => ({
                      ...p,
                      canDownloadFiles: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#141413]"
                />
                <span>Allow downloading files</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={grantPerms.canComment}
                  onChange={(e) =>
                    setGrantPerms((p) => ({
                      ...p,
                      canComment: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#141413]"
                />
                <span>Allow posting review comments on versions</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={grantPerms.canApproveVersions}
                  onChange={(e) =>
                    setGrantPerms((p) => ({
                      ...p,
                      canApproveVersions: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#141413]"
                />
                <span>Allow approving versions/branches</span>
              </label>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
