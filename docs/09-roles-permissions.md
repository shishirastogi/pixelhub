# 09 — Roles & Permissions

Four roles, scoped permissions. MVP ships **Owner-only** (single-creator); full matrix lands in Phase 2. Documented now so schema & APIs are role-ready from day one.

## 1. Roles

| Role | Who | Default intent |
|---|---|---|
| **Owner** | The project creator / main designer | Full control |
| **Contributor** | Another designer/editor on the team | Create & edit design work |
| **Reviewer** | Art director / senior reviewer | Approve, comment, brand-check — no destructive edits |
| **Client** | The paying customer | See progress, comment, approve versions — read-mostly |

## 2. Permission Matrix

Legend: ● = allowed, ○ = own items only, – = denied.
"Own items" = entities they created (comments, tasks assigned). AI actions inherit the parent entity's permission.

| Capability | Owner | Contributor | Reviewer | Client |
|---|---|---|---|---|
| View Pulse & analytics | ● | ● | ● | ● (Pulse only) |
| View files / versions / brand kit | ● | ● | ● | ● (read-only) |
| Create/edit snapshot versions | ● | ● (their branches) | – | – |
| Create/switch/merge branches | ● | ● (concept/experimental) | – | – |
| Edit brief & requirements | ● | ● | – | – |
| Accept/dismiss AI-extracted requirements | ● | ● | – | – |
| Link files → requirements | ● | ● | – | – |
| Upload files / pair watcher | ● | ● | ● | – |
| Edit Brand Kit | ● | ● (suggest→Owner approve) | – | – |
| Run brand checks | ● | ● | ● | – |
| Approve a version (mark APPROVED) | ● | ● | ● | – |
| Comment / annotate | ● | ● | ● | ○ |
| Convert comment → task | ● | ● | ○ | – |
| Create/manage tasks | ● | ● | ○ | – |
| Design Sheet editing | ● | ● | ○ | – |
| Decision Log write | ● | ● | ○ | – |
| Invite/remove members, change roles | ● | – | – | – |
| Toggle AI features, project settings | ● | – | – | – |
| Archive/delete project | ● | – | – | – |

## 3. Enforcement Architecture

- **Middleware:** `requireRole(projectId, [...allowedRoles])` — resolves membership, checks role, 403 with `ROLE_FORBIDDEN` otherwise. Applied per-route (see `03`).
- **"Own items" rules:** applied in the service layer, not the route (`if resource.createdById !== ctx.user.id → 403`).
- **Data scoping:** Role determines which branch/version/file fields are returned (Clients get comments + previews only, never S3 download of source files unless `owner` releases a deliverable).
- **Client view:** a dedicated read-only surface (`/p/[slug]/review`) — Pulse summary + version list + comment box + approve button. No left nav to internal tabs.

## 4. Invitation Flow

```
Owner → Settings → Members → "Invite" → email + role
  → creates ProjectMember (status: INVITED) + invite token email
Invitee → accepts → status: ACTIVE, role set
Owner → change role / remove (revoke) anytime
```

## 5. Permission → UI Mapping

Implemented in `04`: buttons render conditionally via a client-side `usePermissions()` hook mirroring the server matrix (server is always the source of truth — UI hiding is UX only, not security).

| UI area | Hidden/disabled for |
|---|---|
| Branch create/merge buttons | Reviewer, Client |
| Brief editor, requirement accept buttons | Reviewer, Client |
| Brand Kit editor, "Run check" | Client |
| "Invite member", watcher pair, settings | non-Owner |
| Convert-comment-to-task | Client |
| Download source files | Client (deliverable exports allowed) |

## 6. Edge Cases & Rules

- Owner is always exactly one (MVP). Demote/transfer ownership → Phase 2 (transfer token flow).
- A `REVIEWER` cannot create branches but *can* mark a version `APPROVED` (their core job).
- Clients never see `AiJob` internals, token usage, or `ActivityEvent` feed (internal analytics hidden from them).
- Soft-deleted entities respect the same permission rules.
- Watcher token == Contributor-scoped permission (upload + match), never Owner.