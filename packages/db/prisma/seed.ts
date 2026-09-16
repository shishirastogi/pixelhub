import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@pixelhub.dev";
const DEMO_PASSWORD = "password123";
const PROJECT_SLUG = "acme-q4-campaign";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function fakeSha(seed: string): string {
  let h = 0;
  for (const char of seed) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h.toString(16).padStart(8, "0").repeat(8).slice(0, 64);
}

async function main() {
  // Idempotent: wipe the demo project + user, then rebuild.
  await prisma.project.deleteMany({ where: { slug: PROJECT_SLUG } });
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo Designer",
      passwordHash: hashPassword(DEMO_PASSWORD),
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Acme Q4 Campaign",
      slug: PROJECT_SLUG,
      clientName: "Acme Corp",
      description: "Q4 social + web campaign for the Acme product launch.",
      deadline: daysFromNow(14),
      status: "ACTIVE",
      aiEnabled: true,
      members: { create: { userId: user.id, role: "OWNER" } },
      brandKit: {
        create: {
          name: "Acme Brand Kit",
          guidelinesText:
            "Primary brand color is Acme Red. Headings use Inter, body uses Inter. Logo must keep 24px clear space.",
          colors: {
            create: [
              { name: "Primary Red", hex: "#E11D48", role: "PRIMARY", tolerance: 8 },
              { name: "Ink", hex: "#0F172A", role: "TEXT", tolerance: 6 },
              { name: "Cloud", hex: "#F8FAFC", role: "BACKGROUND", tolerance: 6 },
            ],
          },
          fonts: {
            create: [
              { family: "Inter", role: "HEADING", fallbacks: ["system-ui", "sans-serif"] },
              { family: "Inter", role: "BODY", fallbacks: ["system-ui", "sans-serif"] },
            ],
          },
          rules: {
            create: [
              {
                ruleType: "FORBIDDEN_COLOR",
                payload: { hex: "#FF0033", note: "Off-brand hot pink" },
                severity: "WARNING",
              },
              {
                ruleType: "MIN_CLEAR_SPACE",
                payload: { px: 24 },
                severity: "ERROR",
              },
            ],
          },
        },
      },
      branches: {
        create: [
          { name: "Main Concept", slug: "main", kind: "MAIN", status: "ACTIVE" },
          { name: "Client Revision", slug: "client-revision", kind: "REVISION", status: "ACTIVE" },
          { name: "Experimental", slug: "experimental", kind: "EXPERIMENTAL", status: "ACTIVE" },
        ],
      },
    },
    include: { branches: true, brandKit: true },
  });

  const main = project.branches.find((b) => b.slug === "main")!;
  const clientRevision = project.branches.find((b) => b.slug === "client-revision")!;
  const experimental = project.branches.find((b) => b.slug === "experimental")!;
  const brandKit = project.brandKit!;

  await prisma.project.update({
    where: { id: project.id },
    data: { defaultBranchId: main.id },
  });

  await prisma.branch.update({
    where: { id: clientRevision.id },
    data: { parentBranchId: main.id },
  });
  await prisma.branch.update({
    where: { id: experimental.id },
    data: { parentBranchId: main.id },
  });

  // ---- Files (metadata only; blobs are created by the watcher/upload flow) ----
  const fileSpecs: Array<{
    path: string;
    kind: "SOURCE" | "EXPORT" | "DELIVERABLE" | "REFERENCE" | "BRAND_ASSET";
    branchId: string;
  }> = [
    { path: "exports/instagram_post_01.png", kind: "EXPORT", branchId: main.id },
    { path: "exports/instagram_post_02.png", kind: "EXPORT", branchId: main.id },
    { path: "exports/banner_v2.png", kind: "EXPORT", branchId: main.id },
    { path: "source/hero.psd", kind: "SOURCE", branchId: main.id },
    { path: "brand/acme-logo.svg", kind: "BRAND_ASSET", branchId: main.id },
    { path: "references/moodboard-01.jpg", kind: "REFERENCE", branchId: main.id },
  ];

  const files = [];
  for (const spec of fileSpecs) {
    const fileName = spec.path.split("/").pop()!;
    const extension = fileName.split(".").pop()!;
    const file = await prisma.file.create({
      data: {
        projectId: project.id,
        branchId: spec.branchId,
        path: spec.path,
        fileName,
        extension,
        mimeType:
          extension === "png"
            ? "image/png"
            : extension === "jpg"
              ? "image/jpeg"
              : extension === "svg"
                ? "image/svg+xml"
                : extension === "psd"
                  ? "image/vnd.adobe.photoshop"
                  : "application/octet-stream",
        sizeBytes: BigInt(350_000 + fileName.length * 1000),
        sha256: fakeSha(spec.path),
        storageKey: `blobs/${fakeSha(spec.path).slice(0, 2)}/${fakeSha(spec.path)}`,
        uploadedById: user.id,
        kind: spec.kind,
        imageMeta:
          spec.kind === "EXPORT"
            ? { width: 1080, height: 1080, dominantColors: ["#E11D48", "#0F172A"] }
            : undefined,
      },
    });
    files.push(file);
  }

  const ig1 = files.find((f) => f.fileName === "instagram_post_01.png")!;
  const ig2 = files.find((f) => f.fileName === "instagram_post_02.png")!;
  const banner = files.find((f) => f.fileName === "banner_v2.png")!;
  const logo = files.find((f) => f.fileName === "acme-logo.svg")!;

  await prisma.brandLogo.create({
    data: {
      brandKitId: brandKit.id,
      name: "Acme Primary",
      variant: "PRIMARY",
      fileId: logo.id,
      isCurrent: true,
    },
  });

  // ---- Versions on Main ----
  const v1 = await prisma.version.create({
    data: {
      branchId: main.id,
      number: 1,
      label: "Project start",
      note: "Kickoff files and first moodboard.",
      createdById: user.id,
      checksum: "v1-" + fakeSha("v1").slice(0, 16),
      aiSummary: "Initial project files: hero source, first Instagram export, and moodboard.",
      createdAt: daysAgo(12),
    },
  });

  const v2 = await prisma.version.create({
    data: {
      branchId: main.id,
      number: 2,
      parentVersionId: v1.id,
      label: "Client round 1",
      note: "Banner reworked; second Instagram post added.",
      createdById: user.id,
      checksum: "v2-" + fakeSha("v2").slice(0, 16),
      aiSummary: "Banner shifted to a darker gradient and a cooler palette; added a second Instagram post.",
      createdAt: daysAgo(4),
    },
  });

  await prisma.versionFile.createMany({
    data: [
      { versionId: v1.id, fileId: ig1.id, path: ig1.path, role: "EXPORT" },
      { versionId: v1.id, fileId: logo.id, path: logo.path, role: "ASSET" },
      { versionId: v2.id, fileId: ig1.id, path: ig1.path, role: "EXPORT" },
      { versionId: v2.id, fileId: ig2.id, path: ig2.path, role: "EXPORT" },
      { versionId: v2.id, fileId: banner.id, path: banner.path, role: "EXPORT" },
      { versionId: v2.id, fileId: logo.id, path: logo.path, role: "ASSET" },
    ],
  });

  await prisma.branch.update({
    where: { id: main.id },
    data: { headVersionId: v2.id, status: "ACTIVE" },
  });

  // ---- Brief ----
  await prisma.brief.create({
    data: {
      projectId: project.id,
      title: "Acme Q4 Brief",
      rawText:
        "Acme needs a Q4 social push: 3 Instagram posts, a refreshed hero banner, and an updated logo lockup. Use the brand red and Inter. Deadline is the end of the quarter.",
      extractedAt: daysAgo(11),
    },
  });

  // ---- Requirements + Deliverables ----
  const igRequirement = await prisma.requirement.create({
    data: {
      projectId: project.id,
      title: "Instagram Posts",
      description: "Three square posts for the Q4 push.",
      source: "MANUAL",
      status: "ACCEPTED",
      quantity: 3,
      priority: "HIGH",
      sortOrder: 0,
      dueDate: daysFromNow(7),
      deliverables: {
        create: [
          { name: "instagram_post_01", filePatterns: ["instagram_post_*.{png,jpg}"] },
          { name: "instagram_post_02", filePatterns: ["instagram_post_*.{png,jpg}"] },
          { name: "instagram_post_03", filePatterns: ["instagram_post_*.{png,jpg}"] },
        ],
      },
    },
    include: { deliverables: true },
  });

  const bannerRequirement = await prisma.requirement.create({
    data: {
      projectId: project.id,
      title: "Hero Banner",
      description: "Refreshed homepage hero banner.",
      source: "MANUAL",
      status: "ACCEPTED",
      quantity: 1,
      priority: "HIGH",
      sortOrder: 1,
      dueDate: daysAgo(2),
      deliverables: {
        create: [{ name: "hero_banner", filePatterns: ["banner_*.{png,psd}"] }],
      },
    },
    include: { deliverables: true },
  });

  const logoRequirement = await prisma.requirement.create({
    data: {
      projectId: project.id,
      title: "Logo Refresh",
      description: "Updated logo lockup with clear space.",
      source: "MANUAL",
      status: "FULFILLED",
      quantity: 1,
      priority: "MEDIUM",
      sortOrder: 2,
      dueDate: daysFromNow(3),
      deliverables: {
        create: [{ name: "logo_lockup", filePatterns: ["acme-logo*.{svg,png}"] }],
      },
    },
    include: { deliverables: true },
  });

  const newsletterRequirement = await prisma.requirement.create({
    data: {
      projectId: project.id,
      title: "Email Newsletter",
      description: "Optional end-of-quarter newsletter.",
      source: "MANUAL",
      status: "ACCEPTED",
      quantity: 1,
      priority: "LOW",
      sortOrder: 3,
      dueDate: daysFromNow(10),
      createdAt: daysAgo(6),
      deliverables: {
        create: [{ name: "newsletter", filePatterns: ["newsletter_*.{png,jpg,pdf}"] }],
      },
    },
    include: { deliverables: true },
  });

  // Satisfy 2 of 3 Instagram deliverables.
  const igDeliverables = igRequirement.deliverables.sort((a, b) => a.name.localeCompare(b.name));
  for (const [index, file] of [ig1, ig2].entries()) {
    const deliverable = igDeliverables[index]!;
    await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: { status: "SATISFIED", satisfiedByFileId: file.id, satisfiedAt: daysAgo(4 - index) },
    });
    await prisma.requirementFileLink.create({
      data: {
        requirementId: igRequirement.id,
        fileId: file.id,
        linkType: "SATISFIES",
        matchedBy: "WATCHER_RULE",
        confidence: 1,
      },
    });
  }

  // Satisfy the logo requirement fully.
  const logoDeliverable = logoRequirement.deliverables[0]!;
  await prisma.deliverable.update({
    where: { id: logoDeliverable.id },
    data: { status: "SATISFIED", satisfiedByFileId: logo.id, satisfiedAt: daysAgo(9) },
  });
  await prisma.requirementFileLink.create({
    data: {
      requirementId: logoRequirement.id,
      fileId: logo.id,
      linkType: "SATISFIES",
      matchedBy: "MANUAL",
      confidence: 1,
    },
  });

  // ---- Brand check result (failing -> surfaces on Pulse "needs attention") ----
  await prisma.brandCheckResult.create({
    data: {
      projectId: project.id,
      fileId: banner.id,
      checkType: "COLOR",
      status: "FAIL",
      findings: [
        {
          checkType: "COLOR",
          rule: "Uses approved palette",
          expected: "#E11D48",
          found: "#FF0033",
          deltaE: 14.2,
          message: "Off-palette hot pink detected in the banner CTA.",
          severity: "ERROR",
        },
      ],
      createdAt: daysAgo(3),
    },
  });

  // ---- Tasks ----
  await prisma.task.createMany({
    data: [
      {
        projectId: project.id,
        title: "Export Instagram post 03",
        description: "Third square post for the Q4 push.",
        source: "AI_EXTRACTED",
        status: "IN_PROGRESS",
        requirementId: igRequirement.id,
        dueDate: daysFromNow(3),
      },
      {
        projectId: project.id,
        title: "Fix banner brand color",
        description: "CTA uses an off-palette pink.",
        source: "AI_RECOMMENDATION",
        status: "TODO",
        requirementId: bannerRequirement.id,
        dueDate: daysFromNow(1),
      },
      {
        projectId: project.id,
        title: "Confirm newsletter scope with client",
        source: "MANUAL",
        status: "TODO",
        requirementId: newsletterRequirement.id,
        dueDate: daysFromNow(5),
      },
    ],
  });

  // ---- Comments + Decision ----
  await prisma.comment.create({
    data: {
      projectId: project.id,
      versionId: v2.id,
      authorId: user.id,
      body: "Client asked to try a cooler palette on the banner — see if it matches the brand red.",
      anchorJson: { x: 0.42, y: 0.31 },
      status: "OPEN",
    },
  });

  await prisma.decision.create({
    data: {
      projectId: project.id,
      title: "Cooler palette for the banner",
      decision: "Move the hero banner to a cooler gradient while keeping the brand red CTA.",
      reason: "Client feedback on the first round preferred a more editorial feel.",
      status: "DECIDED",
      versionId: v2.id,
      decidedById: user.id,
      decidedAt: daysAgo(4),
    },
  });

  // ---- Activity feed ----
  const events: Array<{ type: string; entityType: string; entityId: string; meta?: object; at: Date }> = [
    { type: "project.created", entityType: "Project", entityId: project.id, at: daysAgo(12) },
    { type: "branch.created", entityType: "Branch", entityId: main.id, at: daysAgo(12) },
    { type: "file.created", entityType: "File", entityId: logo.id, meta: { path: logo.path }, at: daysAgo(11) },
    { type: "version.created", entityType: "Version", entityId: v1.id, meta: { number: 1 }, at: daysAgo(12) },
    { type: "version.created", entityType: "Version", entityId: v2.id, meta: { number: 2 }, at: daysAgo(4) },
    { type: "file.created", entityType: "File", entityId: ig2.id, meta: { path: ig2.path }, at: daysAgo(4) },
    { type: "requirement.fulfilled", entityType: "Requirement", entityId: logoRequirement.id, at: daysAgo(9) },
    { type: "brand_check.failed", entityType: "BrandCheckResult", entityId: banner.id, at: daysAgo(3) },
    { type: "comment.created", entityType: "Comment", entityId: v2.id, at: daysAgo(3) },
  ];

  for (const event of events) {
    await prisma.activityEvent.create({
      data: {
        projectId: project.id,
        actorId: user.id,
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        meta: event.meta,
        createdAt: event.at,
      },
    });
  }

  console.log("Seed complete.");
  console.log(`  user:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  project: ${project.name} (/p/${project.slug})`);
  console.log(`  files:   ${files.length}`);
  console.log(`  requirements: ${[igRequirement, bannerRequirement, logoRequirement, newsletterRequirement].length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
