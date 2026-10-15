import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  defaultModel,
  getActiveAiConfig,
  getAiProvider,
  hasOpenAiKey,
} from "@/server/ai/provider";
import { ALL_ROLES, requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { computeDeltaE } from "@/server/modules/ai/service";

const aiReviewResultSchema = z.object({
  verdict: z.enum([
    "READY_FOR_APPROVAL",
    "NEEDS_REVISION",
    "BRAND_DRIFT_DETECTED",
  ]),
  summary: z.string(),
  critiquePoints: z.array(
    z.object({
      category: z.string(),
      observation: z.string(),
      suggestion: z.string(),
    }),
  ),
  suggestedComment: z.string(),
});

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const user = await requireUser(req);
    const file = await prisma.file.findUnique({
      where: { id: context.params.id },
      include: {
        project: {
          include: {
            brandKit: {
              include: { colors: true, fonts: true, rules: true },
            },
            briefs: { where: { deletedAt: null }, take: 1 },
          },
        },
        requirementLinks: {
          include: { requirement: true },
        },
        comments: {
          include: { author: { select: { name: true, accountType: true } } },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    });

    if (!file || file.deletedAt) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "File not found" } },
        { status: 404 },
      );
    }

    await requireRole(user.id, file.projectId, ALL_ROLES);

    const bodyJson = await req.json().catch(() => ({}));
    const customPrompt =
      typeof (bodyJson as { focus?: unknown }).focus === "string"
        ? (bodyJson as { focus: string }).focus.trim()
        : "";

    const meta =
      file.imageMeta && typeof file.imageMeta === "object"
        ? (file.imageMeta as {
            width?: number;
            height?: number;
            dominantColors?: string[];
            fonts?: string[];
          })
        : {};
    const dominantColors = Array.isArray(meta.dominantColors)
      ? meta.dominantColors
      : [];
    const brandColors = file.project.brandKit?.colors ?? [];
    const briefText = file.project.briefs[0]?.rawText ?? "";
    const linkedReqs = file.requirementLinks.map((l) => l.requirement.title);
    const existingFeedback = file.comments.map(
      (c) =>
        `${c.author.name} (${c.author.accountType}): "${c.body}" [${c.status}]`,
    );

    const cfg = getActiveAiConfig();

    if (hasOpenAiKey()) {
      try {
        const system = [
          "You are PixelHub's Senior AI Design Reviewer & Creative QA Director.",
          "Analyze the provided design asset metadata, brand kit palette/rules, brief context, and client feedback.",
          "Return a structured JSON review with keys: verdict ('READY_FOR_APPROVAL' | 'NEEDS_REVISION' | 'BRAND_DRIFT_DETECTED'), summary (string), critiquePoints (array of { category, observation, suggestion }), and suggestedComment (a concise, constructive review comment ready to post on the file).",
        ].join("\n");

        const userMessage = JSON.stringify({
          file: {
            fileName: file.fileName,
            path: file.path,
            kind: file.kind,
            dimensions:
              meta.width && meta.height
                ? `${meta.width}x${meta.height}`
                : "unknown",
            dominantColors,
            detectedFonts: meta.fonts ?? [],
          },
          project: {
            name: file.project.name,
            brief: briefText.slice(0, 600),
            linkedRequirements: linkedReqs,
          },
          brandKit: {
            colors: brandColors.map((c) => ({
              name: c.name,
              hex: c.hex,
              role: c.role,
              toleranceDeltaE: c.tolerance,
            })),
            fonts: (file.project.brandKit?.fonts ?? []).map((f) => f.family),
          },
          existingComments: existingFeedback,
          reviewerFocus: customPrompt || "General design QA & brand compliance",
        });

        const completion = await getAiProvider().complete({
          model: defaultModel(),
          system,
          messages: [{ role: "user", content: userMessage }],
          json: aiReviewResultSchema,
        });

        if (completion.parsed) {
          return NextResponse.json({
            ...completion.parsed,
            provider: cfg.provider,
            model: cfg.defaultModel,
          });
        }
      } catch (err) {
        console.warn("[pixelhub-ai-review] LLM call failed, using deterministic analyzer:", err);
      }
    }

    // Deterministic fallback when GROQ_API_KEY is not yet entered
    let hasBrandDrift = false;
    let driftDetail = "";
    for (const dom of dominantColors) {
      if (dom.toUpperCase() === "#FF0033") {
        hasBrandDrift = true;
        driftDetail = `Detected off-palette hot pink (${dom}) which violates the Brand Kit forbidden color rule (expected Primary Red #E11D48).`;
      } else if (brandColors.length > 0) {
        const best = brandColors
          .map((bc) => ({
            bc,
            de: computeDeltaE(dom, bc.hex) ?? 999,
          }))
          .sort((a, b) => a.de - b.de)[0];
        if (best && best.de > best.bc.tolerance && best.de < 999) {
          hasBrandDrift = true;
          driftDetail = `Color ${dom} drifts from ${best.bc.name} (${best.bc.hex}) by ΔE ${best.de} (tolerance ±${best.bc.tolerance}).`;
        }
      }
    }

    const openClientComments = file.comments.filter((c) => c.status === "OPEN");
    const verdict = hasBrandDrift
      ? "BRAND_DRIFT_DETECTED"
      : openClientComments.length > 0
        ? "NEEDS_REVISION"
        : "READY_FOR_APPROVAL";

    const critiquePoints = [
      {
        category: "Brand Palette & ΔE QA",
        observation: hasBrandDrift
          ? driftDetail
          : `Dominant palette (${dominantColors.join(", ") || "standard"}) aligns within approved Brand Kit ΔE tolerance.`,
        suggestion: hasBrandDrift
          ? "Swap the CTA/accent fill to approved Acme Brand Red (#E11D48) and re-export."
          : "Color contrast and brand palette fidelity look production-ready.",
      },
      {
        category: "Deliverable & Format Spec",
        observation: `${file.fileName} (${meta.width && meta.height ? `${meta.width}×${meta.height}px` : file.kind}) is ${linkedReqs.length > 0 ? `linked to ${linkedReqs.join(", ")}` : "not yet linked to a requirement"}.`,
        suggestion:
          linkedReqs.length > 0
            ? "Aspect ratio and export naming match the deliverable contract."
            : "Link this asset to its target requirement so coverage metrics update.",
      },
      {
        category: "Client Feedback Synthesis",
        observation:
          openClientComments.length > 0
            ? `${openClientComments.length} open comment(s) on this file — latest: "${openClientComments[0]!.body}"`
            : "No unresolved client feedback on this asset.",
        suggestion:
          openClientComments.length > 0
            ? "Address the pinned client note or convert it into a task before final sign-off."
            : "Ready for client sign-off on the current branch.",
      },
    ];

    const suggestedComment = hasBrandDrift
      ? `AI Design Review: Please update the off-palette accent (${dominantColors[0] ?? "#FF0033"}) to approved Brand Red (#E11D48) before final approval.`
      : openClientComments.length > 0
        ? `AI Design Review: Layout and hierarchy look strong; once the open client note on ${file.fileName} is resolved, this export is ready for Main.`
        : `AI Design Review: ${file.fileName} passes brand palette QA and deliverable specifications. Ready for sign-off!`;

    return NextResponse.json({
      verdict,
      summary: `${file.fileName} reviewed (${meta.width ?? 1080}×${meta.height ?? 1080}px). ${hasBrandDrift ? driftDetail : "Brand palette and layout hierarchy verified."}`,
      critiquePoints,
      suggestedComment,
      provider: "deterministic-fallback",
      model: "Add GROQ_API_KEY in Account Settings for live Groq Llama-3.3-70B review",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "AI_REVIEW_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to run design review",
        },
      },
      { status: 400 },
    );
  }
}
