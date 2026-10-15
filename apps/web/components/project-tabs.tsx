"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { cn, formatBytes, formatDate, initials } from "@/lib/utils";
import { Badge, PixelHubLogo } from "@/components/ui";
import { Button, ErrorText, Field, Input, Select, Textarea } from "@/components/form";
import { Modal } from "@/components/modal";
import { UserProfileModal } from "@/components/user-profile-modal";

const TABS = [
  { label: "Dashboard", segment: "" },
  { label: "Brief", segment: "brief" },
  { label: "Versions", segment: "versions" },
  { label: "Compare", segment: "compare" },
  { label: "Analytics", segment: "analytics" },
  { label: "Decisions", segment: "decisions" },
  { label: "Design Sheet", segment: "design-sheet" },
  { label: "Brand Kit", segment: "brand-kit" },
  { label: "Files", segment: "files" },
  { label: "Tasks", segment: "tasks" },
  { label: "Settings", segment: "settings" },
  { label: "Help & FAQ", segment: "help" },
] as const;

export function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/p/${slug}`;

  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base;

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition",
              active
                ? "bg-[#141413] text-white shadow-pill"
                : "bg-white text-[#6B6860] hover:bg-[#F3F1EC] hover:text-[#141413]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export interface WorkspaceBranchItem {
  id: string;
  name: string;
  kind: string;
  status: string;
  fileCount: number;
}

export interface WorkspaceProjectInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  clientName: string | null;
  deadline: string | null;
  defaultBranchId: string | null;
  counts: {
    files: number;
    requirements: number;
    tasks: number;
    branches: number;
  };
}

export interface WorkspaceMemberItem {
  userId: string;
  role: string;
  canViewFiles: boolean;
  canDownloadFiles: boolean;
  canViewBrief: boolean;
  canComment: boolean;
  canApproveVersions: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    accountType: "DESIGNER" | "CLIENT";
    company: string | null;
    title: string | null;
  };
}

export interface WorkspaceUserPermissions {
  role: string;
  canViewFiles: boolean;
  canDownloadFiles: boolean;
  canViewBrief: boolean;
  canComment: boolean;
  canApproveVersions: boolean;
}

export interface WorkspaceUserInfo {
  id: string;
  name: string;
  email: string;
  accountType: "DESIGNER" | "CLIENT";
  company?: string | null;
  title?: string | null;
}

const ROUTE_META: Record<
  string,
  { title: string; subtitle: string }
> = {
  "": {
    title: "Performance Overview",
    subtitle: "Your deliverables, velocity, and brand insights — all in one place",
  },
  brief: {
    title: "Brief & Requirements",
    subtitle: "Client specifications, auto-matched deliverables, and AI proposals",
  },
  versions: {
    title: "Branches & Versions",
    subtitle: "Immutable design snapshots, creative forks, and Main adoption",
  },
  compare: {
    title: "Visual & Mechanical Diff",
    subtitle: "Compare files, color palettes, typography, and AI change summaries",
  },
  analytics: {
    title: "Performance Analytics",
    subtitle: "Requirement velocity, branch cadence, storage dedupe, and AI telemetry",
  },
  decisions: {
    title: "Creative Decision Log",
    subtitle: "Track proposed, approved, and superseded design decisions with rationale",
  },
  "design-sheet": {
    title: "Research & Design Sheet",
    subtitle: "Moodboards, references, color swatches, and requirement links",
  },
  "brand-kit": {
    title: "Brand Kit & Automated QA",
    subtitle: "Enforce palette ΔE tolerances, typography rules, and export compliance",
  },
  files: {
    title: "Project Files & Watcher",
    subtitle: "Content-addressed assets, live folder sync, and deliverable bindings",
  },
  tasks: {
    title: "Workflow & Tasks",
    subtitle: "Actionable checklists derived from client requirements and reviews",
  },
  settings: {
    title: "Workspace Settings",
    subtitle: "Project metadata, AI configuration, and paired watcher devices",
  },
  help: {
    title: "Help Center, FAQ & AI Chatbot",
    subtitle: "Ask the assistant about your project, browse categorized FAQs, or replay the tour",
  },
};

export function ProjectWorkspaceShell({
  project,
  branches,
  members: initialMembers,
  membership,
  user,
  children,
}: {
  project: WorkspaceProjectInfo;
  branches: WorkspaceBranchItem[];
  members: WorkspaceMemberItem[];
  membership: WorkspaceUserPermissions;
  user: WorkspaceUserInfo;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/p/${project.slug}`;
  const isClientRole = membership.role === "CLIENT";
  const isOwner = membership.role === "OWNER";

  const [activeBranchId, setActiveBranchId] = useState<string | null>(
    project.defaultBranchId,
  );
  const [switchingBranchId, setSwitchingBranchId] = useState<string | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [members, setMembers] =
    useState<WorkspaceMemberItem[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("CLIENT");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePerms, setInvitePerms] = useState({
    canViewFiles: true,
    canDownloadFiles: false,
    canViewBrief: true,
    canComment: true,
    canApproveVersions: true,
  });
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamNote, setTeamNote] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      fileName: string;
      path: string;
      kind: string;
      sizeBytes: string | number;
    }>
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  async function refreshMembers() {
    try {
      const res = await apiFetch<{ members: WorkspaceMemberItem[] }>(
        `/projects/${project.id}/members`,
      );
      setMembers(res.members);
    } catch {
      // non-blocking
    }
  }

  async function handleInviteMember() {
    if (!inviteEmail.trim()) return;
    setTeamBusy(true);
    setTeamError(null);
    setTeamNote(null);
    try {
      await apiFetch(`/projects/${project.id}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          message: inviteMessage.trim() || null,
          ...invitePerms,
        }),
      });
      setInviteEmail("");
      setInviteMessage("");
      setTeamNote(`Invitation sent to ${inviteEmail.trim()}.`);
      await refreshMembers();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setTeamBusy(false);
    }
  }

  async function handleToggleMemberPerm(
    member: WorkspaceMemberItem,
    key:
      | "canViewFiles"
      | "canDownloadFiles"
      | "canViewBrief"
      | "canComment"
      | "canApproveVersions",
  ) {
    setTeamBusy(true);
    setTeamError(null);
    try {
      await apiFetch(`/projects/${project.id}/members/${member.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: !member[key] }),
      });
      await refreshMembers();
      router.refresh();
    } catch (err) {
      setTeamError(
        err instanceof Error ? err.message : "Failed to update permissions",
      );
    } finally {
      setTeamBusy(false);
    }
  }

  async function handleRemoveMember(targetUserId: string) {
    setTeamBusy(true);
    setTeamError(null);
    try {
      await apiFetch(`/projects/${project.id}/members/${targetUserId}`, {
        method: "DELETE",
      });
      await refreshMembers();
      router.refresh();
    } catch (err) {
      setTeamError(
        err instanceof Error ? err.message : "Failed to remove member",
      );
    } finally {
      setTeamBusy(false);
    }
  }

  useEffect(() => {
    setActiveBranchId(project.defaultBranchId);
  }, [project.defaultBranchId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.code === "Space")) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    setSearchLoading(true);
    const params = new URLSearchParams({ limit: "12" });
    if (searchQuery.trim()) params.set("q", searchQuery.trim());

    apiFetch<{
      items: Array<{
        id: string;
        fileName: string;
        path: string;
        kind: string;
        sizeBytes: string | number;
      }>;
    }>(`/projects/${project.id}/files?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setSearchResults(res.items);
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchOpen, searchQuery, project.id]);

  const relativeSegment =
    pathname === base
      ? ""
      : pathname.startsWith(`${base}/`)
        ? pathname.slice(base.length + 1).split("/")[0] ?? ""
        : "";

  const headerMeta = ROUTE_META[relativeSegment] ?? ROUTE_META[""]!;

  function isNavActive(segment: string) {
    const href = segment ? `${base}/${segment}` : base;
    return segment
      ? pathname === href || pathname.startsWith(`${href}/`)
      : pathname === base;
  }

  async function handleSwitchBranch(branchId: string) {
    if (branchId === activeBranchId || switchingBranchId) {
      router.push(`${base}/versions`);
      return;
    }
    setSwitchingBranchId(branchId);
    try {
      await apiFetch(`/branches/${branchId}/switch`, { method: "POST" });
      setActiveBranchId(branchId);
      router.refresh();
    } catch {
      router.push(`${base}/versions`);
    } finally {
      setSwitchingBranchId(null);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen px-2 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1480px] flex-col rounded-[32px] border border-white/70 bg-sidebar-warm p-2.5 shadow-shell lg:flex-row lg:p-3.5">
        {/* LEFT SIDEBAR — RevenueX Warm Stone Navigation */}
        <aside className="flex w-full shrink-0 flex-col justify-between px-2 py-2.5 lg:w-[252px] lg:pr-3.5">
          <div className="space-y-5">
            {/* Brand Logo + Project Switcher Pill */}
            <div className="flex items-center justify-between px-2 pt-1">
              <Link href="/app" className="group flex items-center gap-2">
                <PixelHubLogo />
              </Link>
              <Link
                href="/app"
                title="Switch project"
                className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[#57544E] transition hover:bg-white hover:text-[#141413]"
              >
                Projects ↗
              </Link>
            </div>

            {/* MAIN SECTION */}
            <div>
              <p className="mb-1.5 px-3 text-[11px] font-medium text-[#7D7970]">
                {isClientRole ? "Client Review" : "Main"}
              </p>
              <nav className="space-y-1">
                <SidebarLink
                  href={base}
                  active={isNavActive("")}
                  label={isClientRole ? "Project Progress" : "Dashboard"}
                  icon={
                    <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                      <rect x="2.5" y="2.5" width="5.2" height="5.2" rx="1.4" />
                      <rect x="10.3" y="2.5" width="5.2" height="5.2" rx="1.4" />
                      <rect x="2.5" y="10.3" width="5.2" height="5.2" rx="1.4" />
                      <rect x="10.3" y="10.3" width="5.2" height="5.2" rx="1.4" />
                    </svg>
                  }
                />
                {membership.canViewBrief ? (
                  <SidebarLink
                    href={`${base}/brief`}
                    active={isNavActive("brief")}
                    label="Contracts & Brief"
                    badge={
                      project.counts.requirements > 0
                        ? String(project.counts.requirements)
                        : undefined
                    }
                    badgeTone="subtle"
                    icon={
                      <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                        <path d="M4.5 2.75h6.25L14 6v9.25a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z" />
                        <path d="M10.5 2.75V6H14M6 9.5h6M6 12.25h4" strokeLinecap="round" />
                      </svg>
                    }
                  />
                ) : null}
                <SidebarLink
                  href={`${base}/versions`}
                  active={isNavActive("versions") || isNavActive("compare")}
                  label={
                    isClientRole ? "Versions & Reviews" : "Versions & Branches"
                  }
                  icon={
                    <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="5.5" cy="4.5" r="1.8" />
                      <circle cx="5.5" cy="13.5" r="1.8" />
                      <circle cx="12.5" cy="7.5" r="1.8" />
                      <path d="M5.5 6.3v5.4M7.3 13.5c2.6 0 5.2-1.4 5.2-4.2" strokeLinecap="round" />
                    </svg>
                  }
                />
                {!isClientRole ? (
                  <SidebarLink
                    href={`${base}/analytics`}
                    active={isNavActive("analytics")}
                    label="Analytics"
                    icon={
                      <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                        <path d="M4 14V9.5M9 14V4M14 14V7" strokeLinecap="round" />
                      </svg>
                    }
                  />
                ) : null}
              </nav>
            </div>

            {/* BRANCHES SECTION — Styled like RevenueX "Inboxes" with icon tile + 2-line metadata */}
            <div>
              <div className="mb-1.5 flex items-center justify-between px-3">
                <p className="text-[11px] font-medium text-[#7D7970]">
                  Branches
                </p>
                <Link
                  href={`${base}/versions`}
                  className="text-[11px] font-medium text-[#6B6860] hover:text-[#141413]"
                >
                  + Fork
                </Link>
              </div>
              <div className="space-y-1">
                {branches.slice(0, 4).map((branch) => {
                  const isCurrent = branch.id === activeBranchId;
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => void handleSwitchBranch(branch.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition",
                        isCurrent
                          ? "bg-white/75 shadow-pill"
                          : "hover:bg-white/45",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs transition",
                          isCurrent
                            ? "bg-[#141413] text-white"
                            : "bg-[#DFD9CC]/85 text-[#57544E] group-hover:bg-white",
                        )}
                      >
                        {branch.kind === "MAIN" ? (
                          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.6">
                            <circle cx="5" cy="4.5" r="1.75" />
                            <circle cx="5" cy="11.5" r="1.75" />
                            <circle cx="11" cy="6.5" r="1.75" />
                            <path d="M5 6.25v3.5M6.75 11.5c2.2 0 4.25-1.2 4.25-3.25" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.6">
                            <path d="M6 2.5v3.2L3.4 11.2A1.5 1.5 0 0 0 4.75 13.5h6.5a1.5 1.5 0 0 0 1.35-2.3L10 5.7V2.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5 2.5h6" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-[#141413]">
                            {branch.name}
                          </span>
                          {isCurrent ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9FE830] ring-2 ring-[#141413]/15" />
                          ) : null}
                        </span>
                        <span className="block truncate text-[11px] text-[#6B6860]">
                          {switchingBranchId === branch.id
                            ? "Switching branch…"
                            : `${branch.kind.toLowerCase()} · ${branch.fileCount} file${branch.fileCount === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OTHER / WORKSPACE TOOLS SECTION */}
            <div className="border-t border-[#DCD5C7] pt-3.5">
              <p className="mb-1.5 px-3 text-[11px] font-medium text-[#7D7970]">
                {isClientRole ? "Shared Assets" : "Other"}
              </p>
              <nav className="space-y-1">
                {membership.canViewFiles ? (
                  <SidebarLink
                    href={`${base}/files`}
                    active={isNavActive("files")}
                    label={isClientRole ? "Shared Files" : "Files & Watcher"}
                    badge={String(project.counts.files)}
                    badgeTone="dark"
                    icon={
                      <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                        <rect x="2.5" y="4" width="13" height="10" rx="2" />
                        <path d="m3.5 5.5 5.5 4 5.5-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  />
                ) : null}
                <SidebarLink
                  href={`${base}/brand-kit`}
                  active={isNavActive("brand-kit")}
                  label="Brand Performance"
                  icon={
                    <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3 3.5v11h12" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="m5.5 11.5 3-3 2.5 2 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                />
                {!isClientRole ? (
                  <>
                    <SidebarLink
                      href={`${base}/design-sheet`}
                      active={isNavActive("design-sheet")}
                      label="Design Sheet"
                      icon={
                        <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                          <circle cx="9" cy="9" r="6.25" />
                          <circle cx="7" cy="7.5" r="1" fill="currentColor" />
                          <circle cx="11" cy="7.5" r="1" fill="currentColor" />
                          <circle cx="7.5" cy="11" r="1" fill="currentColor" />
                        </svg>
                      }
                    />
                    <SidebarLink
                      href={`${base}/tasks`}
                      active={isNavActive("tasks")}
                      label="Tasks & QA"
                      badge={
                        project.counts.tasks > 0
                          ? String(project.counts.tasks)
                          : undefined
                      }
                      badgeTone="subtle"
                      icon={
                        <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                          <path d="m4 9.5 3.2 3.2L14 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                  </>
                ) : null}
              </nav>
            </div>

            {/* ACCOUNT SECTION */}
            <div>
              <p className="mb-1.5 px-3 text-[11px] font-medium text-[#7D7970]">
                Account & Access
              </p>
              <nav className="space-y-1">
                {!isClientRole ? (
                  <SidebarLink
                    href={`${base}/settings`}
                    active={isNavActive("settings")}
                    label="Settings"
                    icon={
                      <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                        <circle cx="9" cy="9" r="2.4" />
                        <path d="M9 2.5v1.8M9 13.7v1.8M2.5 9h1.8M13.7 9h1.8M4.4 4.4l1.3 1.3M12.3 12.3l1.3 1.3M13.6 4.4l-1.3 1.3M5.7 12.3l-1.3 1.3" strokeLinecap="round" />
                      </svg>
                    }
                  />
                ) : null}
                <SidebarLink
                  href={`${base}/decisions`}
                  active={isNavActive("decisions")}
                  label="Decision Log"
                  icon={
                    <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3.5 5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7l-3.5 2.5V5.5Z" strokeLinejoin="round" />
                    </svg>
                  }
                />
                <button
                  type="button"
                  onClick={() => setTeamOpen(true)}
                  className="flex w-full items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-[#57544E] transition hover:bg-white/55 hover:text-[#141413]"
                >
                  <span className="flex items-center gap-2.5">
                    <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4 text-[#6B6860]" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="7" cy="6.5" r="2.2" />
                      <path d="M2.8 14c.7-2.1 2.2-3.2 4.2-3.2s3.5 1.1 4.2 3.2" strokeLinecap="round" />
                      <circle cx="12.5" cy="7" r="1.7" />
                      <path d="M12.5 11c1.4 0 2.6.8 3.2 2.4" strokeLinecap="round" />
                    </svg>
                    <span>Team & Permissions</span>
                  </span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DFD9CC] px-1.5 text-[10px] font-semibold text-[#141413]">
                    {members.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="flex w-full items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-[#57544E] transition hover:bg-white/55 hover:text-[#141413]"
                >
                  <span className="flex items-center gap-2.5">
                    <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4 text-[#6B6860]" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="9" cy="6" r="2.8" />
                      <path d="M3.5 15c.9-2.6 3-4 5.5-4s4.6 1.4 5.5 4" strokeLinecap="round" />
                    </svg>
                    <span>Account Settings</span>
                  </span>
                </button>
                <SidebarLink
                  href={`${base}/help`}
                  active={isNavActive("help")}
                  label="Help & FAQ"
                  icon={
                    <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="9" cy="9" r="6.25" />
                      <path d="M7.25 7.25a1.75 1.75 0 1 1 2.4 1.62c-.46.2-.65.5-.65.98v.4" strokeLinecap="round" />
                      <circle cx="9" cy="12.6" r="0.7" fill="currentColor" />
                    </svg>
                  }
                />
              </nav>
            </div>
          </div>

          {/* BOTTOM USER PROFILE CARD — Styled like Evan Parker pill */}
          <div className="relative mt-6 pt-2">
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-2.5 rounded-2xl bg-[#DCD5C6]/85 p-2.5 text-left transition hover:bg-[#D3CBB9]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2E1065] via-[#4C1D95] to-[#141413] text-xs font-semibold text-white shadow-sm">
                  {initials(user.name || user.email)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[#141413]">
                    {user.name}
                  </span>
                  <span className="block truncate text-[11px] text-[#57544E]">
                    {user.email}
                  </span>
                </span>
              </div>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className={cn(
                  "h-4 w-4 shrink-0 text-[#57544E] transition-transform",
                  userMenuOpen && "rotate-180",
                )}
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {userMenuOpen ? (
              <div className="absolute bottom-16 left-0 right-0 z-30 rounded-2xl border border-[#EBE7DF] bg-white p-2 shadow-float">
                <div className="border-b border-[#F2EFE8] px-2.5 py-2">
                  <p className="truncate text-xs font-semibold text-[#141413]">
                    {project.name}
                  </p>
                  <p className="truncate text-[11px] text-[#6B6860]">
                    {project.clientName ?? "Internal project"} ·{" "}
                    {project.status}
                  </p>
                </div>
                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setProfileOpen(true);
                    }}
                    className="w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-[#141413] hover:bg-[#F4F2ED]"
                  >
                    Edit My Profile ({user.accountType})
                  </button>
                  <Link
                    href="/app"
                    className="block rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#141413] hover:bg-[#F4F2ED]"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    {isClientRole
                      ? "← Client Portal Dashboard"
                      : "Switch project"}
                  </Link>
                  {!isClientRole ? (
                    <Link
                      href="/app/new"
                      className="block rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#141413] hover:bg-[#F4F2ED]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      + Create new project
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-rose-700 hover:bg-[#FEECEB]/60"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT CANVAS */}
        <div className="flex flex-1 flex-col rounded-[26px] border border-white/80 bg-[#F8F6F1] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-6 lg:p-7">
          {/* TOP BAR: Global Search + Avatars + Bell + Black CTA */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {/* Search Pill */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full max-w-md items-center justify-between gap-3 rounded-full border border-[#EBE7DF] bg-white px-4 py-2 text-left shadow-pill transition hover:border-[#D5CFC2]"
            >
              <span className="flex items-center gap-2.5 text-xs text-[#6B6860]">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-4 w-4 text-[#141413]"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="m10.5 10.5 3 3" strokeLinecap="round" />
                </svg>
                <span>Search files, deliverables, or versions...</span>
              </span>
              <kbd className="rounded-full bg-[#F3F1EC] px-2.5 py-1 font-sans text-[11px] font-medium text-[#57544E]">
                ⌘ + Space
              </kbd>
            </button>

            {/* Right Utility Controls — REAL Database Project Members */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setTeamOpen(true)}
                className="hidden items-center gap-2 rounded-full border border-[#EBE7DF] bg-white px-2.5 py-1 shadow-pill transition hover:bg-[#FAF8F4] sm:flex"
                title="View project members & client permissions"
              >
                <div className="flex -space-x-1.5">
                  {members.slice(0, 4).map((m, idx) => (
                    <span
                      key={m.userId}
                      title={`${m.user.name} (${m.role})`}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white",
                        idx % 3 === 0
                          ? "bg-[#141413]"
                          : idx % 3 === 1
                            ? "bg-[#6D28D9]"
                            : "bg-[#15803D]",
                      )}
                    >
                      {initials(m.user.name || m.user.email)}
                    </span>
                  ))}
                </div>
                <span className="pr-1 text-xs font-medium text-[#141413]">
                  {members.length} member{members.length === 1 ? "" : "s"} ▾
                </span>
              </button>

              {/* Notification Bell */}
              <Link
                href={base}
                title="Project Pulse & Activity"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EBE7DF] bg-white text-[#141413] shadow-pill transition hover:bg-[#F3F1EC]"
              >
                <svg
                  viewBox="0 0 18 18"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path
                    d="M9 2.75a4.25 4.25 0 0 0-4.25 4.25v2.6L3.5 11.5v.75h11v-.75l-1.25-1.9V7A4.25 4.25 0 0 0 9 2.75Z"
                    strokeLinejoin="round"
                  />
                  <path d="M7.5 14.25a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
                </svg>
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#9FE830] ring-2 ring-white" />
              </Link>

              {/* Solid Black Primary CTA Button */}
              {isClientRole ? (
                <Link
                  href={`${base}/versions`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#141413] px-4 py-2 text-xs font-medium text-white shadow-pill transition hover:bg-[#2A2927]"
                >
                  <span>Review Versions</span>
                  <span>→</span>
                </Link>
              ) : (
                <Link
                  href={`${base}/files`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#141413] px-4 py-2 text-xs font-medium text-white shadow-pill transition hover:bg-[#2A2927]"
                >
                  <span>Export Data</span>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path
                      d="M8 10.5V2.75M8 2.75 5.25 5.5M8 2.75 10.75 5.5M3 10.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              )}
            </div>
          </div>

          {/* EDITORIAL PAGE HEADER ROW */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-serif text-3xl font-normal tracking-[-0.01em] text-[#141413] sm:text-[34px]">
                  {headerMeta.title}
                </h1>
                <Badge tone={project.status === "ACTIVE" ? "lime" : "neutral"}>
                  {project.name}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[#6B6860]">
                {headerMeta.subtitle}
                {project.clientName ? ` · Client: ${project.clientName}` : ""}
                {project.deadline
                  ? ` · Due ${formatDate(project.deadline)}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] shadow-pill transition hover:bg-[#F3F1EC]"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-500",
                    refreshing && "rotate-180",
                  )}
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path
                    d="M13.25 8a5.25 5.25 0 1 1-1.2-3.35M13.25 2.75v2.5h-2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setCustomizeOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] shadow-pill transition hover:bg-[#F3F1EC]"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path
                    d="M2.5 5.5h11M2.5 10.5h11"
                    strokeLinecap="round"
                  />
                  <circle cx="5.5" cy="5.5" r="1.5" fill="white" />
                  <circle cx="10.5" cy="10.5" r="1.5" fill="white" />
                </svg>
                <span>Customize View</span>
              </button>
            </div>
          </div>

          {/* Mobile Quick Pill Bar */}
          <div className="mb-4 lg:hidden">
            <ProjectTabs slug={project.slug} />
          </div>

          {/* CLIENT PERMISSIONS BANNER (When viewing as a Client) */}
          {isClientRole ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200/80 bg-ai-sky px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="dark">Client Review Access</Badge>
                <span className="font-medium text-[#141413]">
                  Your permissions on {project.name}:
                </span>
                <Badge tone="lime">✓ View Progress</Badge>
                {membership.canViewBrief ? (
                  <Badge tone="neutral">✓ Brief & Specs</Badge>
                ) : null}
                {membership.canViewFiles ? (
                  <Badge tone="neutral">✓ View Files</Badge>
                ) : (
                  <Badge tone="warning">Files Restricted</Badge>
                )}
                {membership.canDownloadFiles ? (
                  <Badge tone="neutral">✓ Download Exports</Badge>
                ) : null}
                {membership.canComment ? (
                  <Badge tone="neutral">✓ Post Reviews</Badge>
                ) : null}
                {membership.canApproveVersions ? (
                  <Badge tone="neutral">✓ Approve Versions</Badge>
                ) : null}
              </div>
              <Link
                href={`${base}/versions`}
                className="font-semibold text-[#141413] underline"
              >
                Leave Review on Latest Version →
              </Link>
            </div>
          ) : null}

          {/* MAIN WORKSPACE CONTENT */}
          <div className="flex-1">{children}</div>
        </div>
      </div>

      {/* USER PROFILE MODAL */}
      <UserProfileModal
        user={user}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      {/* REAL TEAM & CLIENT PERMISSIONS MODAL */}
      <Modal
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        title={`Team & Client Access — ${project.name}`}
        width="max-w-2xl"
      >
        <div className="space-y-5 text-xs">
          <div>
            <p className="mb-2 font-semibold uppercase tracking-wider text-[#6B6860]">
              Active Project Members ({members.length})
            </p>
            <div className="divide-y divide-[#F4F2ED] rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4]">
              {members.map((m) => (
                <div key={m.userId} className="p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#141413] text-xs font-semibold text-white">
                        {initials(m.user.name || m.user.email)}
                      </span>
                      <div>
                        <p className="font-semibold text-[#141413]">
                          {m.user.name}{" "}
                          <span className="font-normal text-[#6B6860]">
                            ({m.user.email})
                          </span>
                        </p>
                        <p className="text-[11px] text-[#6B6860]">
                          {m.user.accountType}
                          {m.user.company ? ` · ${m.user.company}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={m.role === "OWNER" ? "lime" : "info"}>
                        {m.role}
                      </Badge>
                      {isOwner && m.userId !== user.id ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={teamBusy}
                          onClick={() => void handleRemoveMember(m.userId)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* Granular Client Permission Toggles (Owner can toggle live) */}
                  {m.role === "CLIENT" ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#EBE7DF] pt-2.5">
                      {(
                        [
                          ["canViewBrief", "View Brief"],
                          ["canViewFiles", "View Files"],
                          ["canDownloadFiles", "Download Files"],
                          ["canComment", "Leave Reviews"],
                          ["canApproveVersions", "Approve Versions"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          disabled={!isOwner || teamBusy}
                          onClick={() => void handleToggleMemberPerm(m, key)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                            m[key]
                              ? "border-[#141413] bg-[#9FE830] text-[#141413]"
                              : "border-[#EBE7DF] bg-white text-[#9A968C]",
                          )}
                        >
                          {m[key] ? "✓ " : "○ "}
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {isOwner ? (
            <div className="rounded-2xl border border-[#EBE7DF] bg-white p-4">
              <p className="mb-3 font-semibold uppercase tracking-wider text-[#6B6860]">
                Invite Client or Team Member to {project.name}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email Address">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="client@acme.com"
                  />
                </Field>
                <Field label="Role">
                  <Select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="CLIENT">CLIENT (Review & Progress)</option>
                    <option value="REVIEWER">REVIEWER (QA & Approvals)</option>
                    <option value="CONTRIBUTOR">CONTRIBUTOR (Designer)</option>
                  </Select>
                </Field>
              </div>

              {inviteRole === "CLIENT" ? (
                <div className="mt-3 flex flex-wrap gap-3 rounded-xl bg-[#FAF8F4] p-3">
                  {(
                    [
                      ["canViewBrief", "View Brief"],
                      ["canViewFiles", "View Files"],
                      ["canDownloadFiles", "Download Exports"],
                      ["canComment", "Post Reviews"],
                      ["canApproveVersions", "Approve Versions"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={invitePerms[key]}
                        onChange={(e) =>
                          setInvitePerms((p) => ({
                            ...p,
                            [key]: e.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 accent-[#141413]"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Optional welcome message for the client…"
                />
                <Button
                  size="sm"
                  disabled={teamBusy || !inviteEmail.trim()}
                  onClick={() => void handleInviteMember()}
                >
                  {teamBusy ? "Sending…" : "Send Invite"}
                </Button>
              </div>
              {teamError ? (
                <div className="mt-2">
                  <ErrorText>{teamError}</ErrorText>
                </div>
              ) : null}
              {teamNote ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  {teamNote}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* QUICK SEARCH / COMMAND PALETTE MODAL (⌘ + Space) */}
      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Search workspace & jump to view"
        width="max-w-xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a filename, deliverable pattern, or view name…"
              className="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF8F4] px-4 py-3 text-sm text-[#141413] outline-none focus:border-[#7C3AED] focus:bg-white"
            />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#6B6860]">
              Workspace Views
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((tab) => {
                const href = tab.segment ? `${base}/${tab.segment}` : base;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(href);
                    }}
                    className="rounded-full border border-[#EBE7DF] bg-white px-3 py-1.5 text-xs font-medium text-[#141413] transition hover:border-[#7C3AED] hover:bg-[#F3EEFF]"
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#6B6860]">
              Project Files {searchLoading ? "· searching…" : ""}
            </p>
            {searchResults.length === 0 ? (
              <p className="rounded-xl bg-[#FAF8F4] p-4 text-center text-xs text-[#6B6860]">
                No matching files found in {project.name}.
              </p>
            ) : (
              <ul className="max-h-60 divide-y divide-[#F2EFE8] overflow-y-auto rounded-2xl border border-[#EBE7DF] bg-white">
                {searchResults.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        router.push(`${base}/files`);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs transition hover:bg-[#FAF8F4]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#141413]">
                          {file.fileName}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-[#6B6860]">
                          {file.path}
                        </span>
                      </span>
                      <span className="ml-3 shrink-0 text-[11px] text-[#6B6860]">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {/* CUSTOMIZE VIEW / WORKSPACE OVERVIEW MODAL */}
      <Modal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Workspace & Branch Overview"
        width="max-w-lg"
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl bg-[#FAF8F4] p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#141413]">
                {project.name}
              </span>
              <Badge tone="lime">{project.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-[#6B6860]">
              Client: {project.clientName ?? "None"} · Deadline:{" "}
              {formatDate(project.deadline)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-2.5 shadow-pill">
                <p className="text-lg font-bold text-[#141413]">
                  {project.counts.files}
                </p>
                <p className="text-[11px] text-[#6B6860]">Tracked Files</p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-pill">
                <p className="text-lg font-bold text-[#6D28D9]">
                  {project.counts.requirements}
                </p>
                <p className="text-[11px] text-[#6B6860]">Requirements</p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-pill">
                <p className="text-lg font-bold text-[#141413]">
                  {project.counts.tasks}
                </p>
                <p className="text-[11px] text-[#6B6860]">Tasks</p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#6B6860]">
              Switch Active Branch
            </p>
            <div className="space-y-1.5">
              {branches.map((branch) => {
                const active = branch.id === activeBranchId;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => {
                      setCustomizeOpen(false);
                      void handleSwitchBranch(branch.id);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs transition",
                      active
                        ? "border-[#141413] bg-[#141413] text-white"
                        : "border-[#EBE7DF] bg-white text-[#141413] hover:bg-[#FAF8F4]",
                    )}
                  >
                    <span>
                      <span className="font-semibold">{branch.name}</span>{" "}
                      <span className="opacity-70">({branch.kind})</span>
                    </span>
                    <span>
                      {branch.fileCount} files {active ? "· Current" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SidebarLink({
  href,
  active,
  label,
  icon,
  badge,
  badgeTone = "dark",
}: {
  href: string;
  active: boolean;
  label: string;
  icon: ReactNode;
  badge?: string;
  badgeTone?: "dark" | "subtle";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs transition-all duration-150",
        active
          ? "bg-white font-semibold text-[#141413] shadow-pill"
          : "font-medium text-[#57544E] hover:bg-white/55 hover:text-[#141413]",
      )}
    >
      <span className="flex items-center gap-2.5">
        <span className={cn(active ? "text-[#141413]" : "text-[#6B6860]")}>
          {icon}
        </span>
        <span>{label}</span>
      </span>
      {badge ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
            badgeTone === "dark"
              ? "bg-[#141413] text-white"
              : "bg-[#DFD9CC] text-[#141413]",
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
