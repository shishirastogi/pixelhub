import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { defaultModel, getAiProvider, hasOpenAiKey } from "@/server/ai/provider";
import { getMembership, resolveProject } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";

const chatBodySchema = z.object({
  message: z.string().min(1).max(2000),
  projectId: z.string().nullable().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

interface LiveProjectContext {
  name: string;
  slug: string;
  clientName: string | null;
  deadline: string | null;
  status: string;
  userRole: string;
  coveragePct: number;
  deliverablesDone: number;
  deliverablesTotal: number;
  openDeliverables: string[];
  satisfiedDeliverables: string[];
  requirementsSummary: string[];
  branchesSummary: string[];
  filesSummary: string[];
  openTasksCount: number;
  openCommentsCount: number;
  recentComments: string[];
  brandFails: string[];
}

async function loadProjectContext(
  userId: string,
  projectIdOrSlug?: string | null,
): Promise<LiveProjectContext | null> {
  if (!projectIdOrSlug) return null;
  try {
    const project = await resolveProject(projectIdOrSlug);
    const membership = await getMembership(userId, project.id);
    if (!membership) return null;

    const [requirements, branches, files, openTasksCount, comments, brandFails] =
      await Promise.all([
        prisma.requirement.findMany({
          where: { projectId: project.id, deletedAt: null },
          include: { deliverables: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.branch.findMany({
          where: { projectId: project.id, deletedAt: null },
          include: { headVersion: true },
        }),
        prisma.file.findMany({
          where: { projectId: project.id, deletedAt: null },
          select: { fileName: true, path: true, kind: true },
          take: 20,
        }),
        prisma.task.count({
          where: { projectId: project.id, status: { in: ["TODO", "IN_PROGRESS"] } },
        }),
        prisma.comment.findMany({
          where: { projectId: project.id },
          include: { author: { select: { name: true } }, file: { select: { fileName: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.brandCheckResult.findMany({
          where: { projectId: project.id, status: "FAIL", resolvedAt: null },
          include: { file: { select: { fileName: true } } },
          take: 5,
        }),
      ]);

    const acceptedReqs = requirements.filter(
      (r) => r.status === "ACCEPTED" || r.status === "FULFILLED",
    );
    const fulfilledReqs = acceptedReqs.filter((r) => r.status === "FULFILLED");
    const coveragePct =
      acceptedReqs.length > 0
        ? Math.round((fulfilledReqs.length / acceptedReqs.length) * 100)
        : 0;

    const allDeliverables = acceptedReqs.flatMap((r) => r.deliverables);
    const satisfied = allDeliverables.filter((d) => d.status === "SATISFIED");
    const open = allDeliverables.filter((d) => d.status !== "SATISFIED");

    return {
      name: project.name,
      slug: project.slug,
      clientName: project.clientName,
      deadline: project.deadline
        ? project.deadline.toISOString().slice(0, 10)
        : null,
      status: project.status,
      userRole: membership.role,
      coveragePct,
      deliverablesDone: satisfied.length,
      deliverablesTotal: allDeliverables.length,
      openDeliverables: open.map(
        (d) => `${d.name} (patterns: ${d.filePatterns.join(", ")})`,
      ),
      satisfiedDeliverables: satisfied.map((d) => d.name),
      requirementsSummary: acceptedReqs.map(
        (r) =>
          `${r.title} [${r.status}] (${r.deliverables.filter((d) => d.status === "SATISFIED").length}/${r.deliverables.length} deliverables)`,
      ),
      branchesSummary: branches.map(
        (b) =>
          `${b.name} (${b.kind}, ${b.status}${b.headVersion ? `, head v${b.headVersion.number}` : ", no snapshots"})`,
      ),
      filesSummary: files.map((f) => `${f.fileName} (${f.kind})`),
      openTasksCount,
      openCommentsCount: comments.filter((c) => c.status === "OPEN").length,
      recentComments: comments.map(
        (c) =>
          `${c.author?.name ?? "Reviewer"}${c.file ? ` on ${c.file.fileName}` : ""}: "${c.body}" [${c.status}]`,
      ),
      brandFails: brandFails.map((bf) => bf.file.fileName),
    };
  } catch {
    return null;
  }
}

function buildSmartReply(
  question: string,
  userAccountType: "DESIGNER" | "CLIENT",
  projectCtx: LiveProjectContext | null,
): { reply: string; suggestedQuestions: string[] } {
  const q = question.toLowerCase();

  // 1. Live Project Status / Progress / Deliverables Queries
  if (
    projectCtx &&
    /\b(status|progress|coverage|where do we stand|stand|summary|overview|health|how is the project)\b/.test(
      q,
    )
  ) {
    const openList =
      projectCtx.openDeliverables.length > 0
        ? `Still open: ${projectCtx.openDeliverables.join("; ")}.`
        : "All deliverables are satisfied!";
    return {
      reply: `**${projectCtx.name}** (${projectCtx.status}) is currently at **${projectCtx.coveragePct}% requirement coverage** with **${projectCtx.deliverablesDone}/${projectCtx.deliverablesTotal} deliverables matched**.\n\n• **Requirements**: ${projectCtx.requirementsSummary.join(" · ") || "None yet"}\n• **Deliverables**: ${openList}\n• **Branches**: ${projectCtx.branchesSummary.join(" · ")}\n• **Open Tasks**: ${projectCtx.openTasksCount} · **Open Reviews**: ${projectCtx.openCommentsCount}${projectCtx.brandFails.length > 0 ? `\n• **Brand QA Alerts**: Failing check on ${projectCtx.brandFails.join(", ")}` : ""}`,
      suggestedQuestions: [
        "Which deliverables are still missing?",
        "What client comments are open on this project?",
        "How do I snapshot a new version?",
      ],
    };
  }

  if (
    projectCtx &&
    /\b(missing|open deliverable|outstanding|unfulfilled|what is left|remaining|need to upload)\b/.test(
      q,
    )
  ) {
    if (projectCtx.openDeliverables.length === 0) {
      return {
        reply: `Every deliverable in **${projectCtx.name}** (${projectCtx.deliverablesDone}/${projectCtx.deliverablesTotal}) is already satisfied! You can freeze a milestone snapshot on the **Versions** tab.`,
        suggestedQuestions: [
          "How do I create a version snapshot?",
          "Are there any brand QA issues?",
        ],
      };
    }
    return {
      reply: `In **${projectCtx.name}**, **${projectCtx.openDeliverables.length}** deliverable(s) are still open:\n\n${projectCtx.openDeliverables.map((d) => `• ${d}`).join("\n")}\n\n${
        userAccountType === "DESIGNER"
          ? "Drop a file matching those glob patterns into `exports/` (via the **Files** tab or `pixelhub-watch`) and PixelHub will automatically mark the deliverable as SATISFIED."
          : "Your design team is currently working on these exports. Once uploaded, they will automatically flip to Available on your dashboard."
      }`,
      suggestedQuestions: [
        "How does automatic file pattern matching work?",
        "How do I pair the folder watcher?",
      ],
    };
  }

  if (
    projectCtx &&
    /\b(comment|feedback|review|pin|annotation)\b/.test(q) &&
    /\b(what|open|list|recent|any|client)\b/.test(q)
  ) {
    return {
      reply:
        projectCtx.recentComments.length > 0
          ? `There are **${projectCtx.openCommentsCount} open review comment(s)** on **${projectCtx.name}**:\n\n${projectCtx.recentComments.map((c) => `• ${c}`).join("\n")}\n\nYou can click any artwork on the **Dashboard** or **Files** tab to open the Visual Lightbox, see numbered spatial pins on the canvas, reply, resolve, or convert comments into tasks.`
          : `There are currently no review comments on **${projectCtx.name}**. Click any artwork in the **Files** gallery or **Dashboard** to open the Visual Lightbox and click on the image canvas to drop a spatial review pin.`,
      suggestedQuestions: [
        "How do I drop a spatial pin comment on an image?",
        "How do I convert a client comment into a task?",
      ],
    };
  }

  // 2. Watcher CLI & Folder Sync
  if (/\b(watcher|watch|pair|sync|folder|cli|pixelhub-watch|local)\b/.test(q)) {
    return {
      reply: `**How the Folder Watcher (\`pixelhub-watch\`) works:**\n\n1. Open **Files** or **Settings** in your project and click **Pair this folder** to generate an 8-character pairing code.\n2. In your local design folder, run:\n   \`npx pixelhub-watch pair --server http://localhost:3000\`\n3. Paste the pairing code when prompted.\n4. The agent hashes every file with **SHA-256** (content-addressed deduplication), watches for creates/modifies/deletes/renames with a 2-second debounce, and uploads only new blobs.\n5. Whenever a file in \`exports/\` matches a deliverable pattern (like \`instagram_post_*.png\`), the deliverable flips to **SATISFIED** automatically!`,
      suggestedQuestions: [
        "What files does the watcher ignore?",
        "How do deliverable glob patterns work?",
      ],
    };
  }

  // 3. Deliverable Auto-Tracking & Glob Patterns
  if (/\b(deliverable|pattern|glob|auto|match|requirement|brief|extract)\b/.test(q)) {
    return {
      reply: `**Auto-Tracked Deliverables & Brief Extraction:**\n\n• **Brief & AI Extraction**: On the **Contracts & Brief** tab, paste the client brief and click **Extract requirements**. PixelHub proposes requirements as \`PENDING\` cards that you can **Accept** or **Dismiss**.\n• **Glob File Patterns**: Each requirement has one or more deliverables with a glob pattern (e.g., \`instagram_post_*.{png,jpg}\` or \`banner_*.png\`).\n• **Deterministic Matching**: When you upload a file or drop it into your watched folder, PixelHub's matcher checks the filename against open deliverables. On a match, the file is linked, the deliverable becomes \`SATISFIED\`, and once all deliverables on a requirement are satisfied, the requirement flips to **FULFILLED**!`,
      suggestedQuestions: [
        "Can I manually link a file to a requirement?",
        "How do I generate tasks from a requirement?",
      ],
    };
  }

  // 4. Branches, Versions, Adopt into Main & Compare
  if (/\b(branch|version|snapshot|merge|adopt|compare|diff|restore|fork)\b/.test(q)) {
    return {
      reply: `**Branches, Versions & Visual Diffs:**\n\n• **Designer-Friendly Branches**: Create **Concept** (explore a direction), **Revision** (client feedback round), or **Experimental** branches on the **Versions & Branches** tab. Forking copies the parent branch's latest snapshot so branches never overwrite each other.\n• **Immutable Snapshots**: Click **Snapshot current state** to freeze a version (\`v1\`, \`v2\`, etc.) with a SHA-256 manifest checksum.\n• **Compare Versions**: Check any two versions on the **Versions** tab and click **Compare selected** (or use the **Compare** tab) to inspect added/removed/modified/renamed files, dominant color shifts, typography changes, and an AI summary.\n• **Adopt into Main**: When a branch is approved, click **Adopt into Main** to choose which files carry over into a new Main version with full provenance.`,
      suggestedQuestions: [
        "How can a client approve a version or branch?",
        "How do I restore an older version?",
      ],
    };
  }

  // 5. Brand Kit & CIE76 ΔE Checks
  if (/\b(brand|kit|delta|color|palette|font|logo|rule|qa|check)\b/.test(q)) {
    return {
      reply: `**Brand Kit & Automated CIE76 ΔE QA:**\n\n• On the **Brand Performance (Brand Kit)** tab, define your brand colors (with a **ΔE color-distance tolerance**, e.g. \`±8\`), approved fonts, logo files, and rules (such as \`FORBIDDEN_COLOR #FF0033\` or \`MIN_CLEAR_SPACE 24px\`).\n• When an export lands (or when you click **Run brand check**), PixelHub extracts dominant colors from your images via \`sharp\`, calculates **CIE76 ΔE color distance** against your brand palette, and flags off-brand shades or rule violations.\n• You can expand any finding to see \`expected vs found · ΔE\`, click **Re-check file**, or **Mark resolved**.`,
      suggestedQuestions: [
        "What is ΔE tolerance in the Brand Kit?",
        "Which files in this project have brand check errors?",
      ],
    };
  }

  // 6. Client Access, Invitations, Permissions & Pinpoint Reviews
  if (/\b(client|invite|invitation|access|request|permission|role|slug|pin|review)\b/.test(q)) {
    return {
      reply: `**Client Portal, Access Requests & Granular Permissions:**\n\n• **Account Types**: At signup, users choose either a **Designer** or **Client** account (permanently locked).\n• **Requesting & Granting Access**: Clients can enter a **Project Slug** (e.g. \`acme-q4-campaign\`) on their Client Dashboard to request access, or Designers can invite a client by email.\n• **Granular Permissions**: Designers can toggle 5 permission flags per client at any time via **Team & Permissions**:\n  1. \`View Brief & Specs\`\n  2. \`View Files\`\n  3. \`Download Exports\`\n  4. \`Leave Reviews\`\n  5. \`Approve Versions\`\n• **Spatial Pinpoint Reviews**: Both Clients and Designers can click any artwork preview to open the Lightbox, click anywhere on the image canvas to drop a numbered pin (\`1\`, \`2\`, \`3\`), and post feedback. Designers can click **→ Convert to Task** or **✓ Resolve** on any client comment.`,
      suggestedQuestions: [
        "How do I change a client's permissions on a project?",
        "How do I replay the interactive onboarding tour?",
      ],
    };
  }

  // 7. Account Settings & Password
  if (/\b(account|password|profile|email|company|title|setting)\b/.test(q)) {
    return {
      reply: `**Account Settings & Security:**\n\nClick **Account Settings** in the left sidebar (or visit \`/app/settings\`) to:\n• Update your **Full Name**, **Email Address**, **Company / Studio**, and **Job Title**.\n• Switch to the **Password & Security** tab to change your password.\n• View all projects you have access to and your active permission badges on each project.`,
      suggestedQuestions: [
        "Can I switch a Client account into a Designer account?",
        "What is the current status of this project?",
      ],
    };
  }

  // Default helpful overview with live project context if available
  const projectLine = projectCtx
    ? `\n\n**Current Project (${projectCtx.name})**: ${projectCtx.coveragePct}% requirement coverage (${projectCtx.deliverablesDone}/${projectCtx.deliverablesTotal} deliverables matched, ${projectCtx.openTasksCount} open tasks, ${projectCtx.openCommentsCount} open reviews).`
    : "";

  return {
    reply: `I'm your **PixelHub Workspace Assistant**! I can help you with any feature of the platform or answer live questions about your project.${projectLine}\n\nTry asking me about:\n• **Project Status**: *"What deliverables are still open in this project?"* or *"What client comments are open?"*\n• **Auto-Tracking**: *"How do glob file patterns auto-satisfy deliverables?"*\n• **Folder Watcher**: *"How do I pair pixelhub-watch with my local folder?"*\n• **Client Reviews**: *"How do spatial pinpoint image comments and client permissions work?"*\n• **Versioning & Brand QA**: *"How do branches, Adopt into Main, and ΔE brand checks work?"*`,
    suggestedQuestions: [
      projectCtx
        ? `What is the status of ${projectCtx.name}?`
        : "How do deliverable glob patterns work?",
      "How do I drop a spatial pin comment on an image?",
      "How do I pair the folder watcher?",
      "How do client permissions and access requests work?",
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = chatBodySchema.parse(await req.json());
    const projectCtx = await loadProjectContext(user.id, body.projectId);

    if (hasOpenAiKey()) {
      try {
        const systemPrompt = [
          "You are the PixelHub Help & Workspace AI Assistant.",
          `The current user is ${user.name} (${user.email}) with accountType=${user.accountType}.`,
          "PixelHub is a version-controlled creative workspace for designers and clients where project state is derived deterministically from files.",
          "Key features: Brief & AI Requirement Extraction, Deliverables with glob file patterns (e.g. instagram_post_*.png), pixelhub-watch CLI folder sync (SHA-256 deduplication), Branches (Main, Concept, Revision, Experimental), Immutable Versions, Adopt into Main, Visual & Mechanical Compare Diff, Brand Kit with CIE76 deltaE color checks, Design Sheet moodboards, Tasks Kanban board, Decision Log, and Client Review Portal with granular permissions (canViewBrief, canViewFiles, canDownloadFiles, canComment, canApproveVersions) and spatial pinpoint image annotations.",
          projectCtx
            ? `Live Project Context for "${projectCtx.name}" (slug: ${projectCtx.slug}): coverage=${projectCtx.coveragePct}%, deliverables=${projectCtx.deliverablesDone}/${projectCtx.deliverablesTotal}, openDeliverables=${JSON.stringify(projectCtx.openDeliverables)}, requirements=${JSON.stringify(projectCtx.requirementsSummary)}, branches=${JSON.stringify(projectCtx.branchesSummary)}, openTasks=${projectCtx.openTasksCount}, openComments=${projectCtx.openCommentsCount}, recentComments=${JSON.stringify(projectCtx.recentComments)}, brandFails=${JSON.stringify(projectCtx.brandFails)}.`
            : "No specific project context selected.",
          "Respond concisely and helpfully using clear bullet points.",
        ].join("\n");

        const completion = await getAiProvider().complete({
          model: defaultModel(),
          system: systemPrompt,
          messages: [
            ...(body.history ?? []).slice(-6),
            { role: "user", content: body.message },
          ],
        });

        if (completion.text) {
          const fallbackMeta = buildSmartReply(
            body.message,
            user.accountType,
            projectCtx,
          );
          return NextResponse.json({
            reply: completion.text,
            suggestedQuestions: fallbackMeta.suggestedQuestions,
          });
        }
      } catch {
        // Fall back to deterministic context-aware engine
      }
    }

    const result = buildSmartReply(body.message, user.accountType, projectCtx);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "HELP_CHAT_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to process question",
        },
      },
      { status: 400 },
    );
  }
}
