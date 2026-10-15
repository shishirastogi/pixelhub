import { createHash, createHmac, randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ??=
  "postgresql://pixelhub:pixelhub@localhost:5432/pixelhub?schema=public";

const prisma = new PrismaClient();

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

async function uploadToMinio(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  try {
    const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
    const bucket = process.env.S3_BUCKET ?? "pixelhub";
    const accessKey = process.env.S3_ACCESS_KEY_ID ?? "pixelhub";
    const secretKey = process.env.S3_SECRET_ACCESS_KEY ?? "pixelhub-secret";
    const region = process.env.S3_REGION ?? "us-east-1";

    const url = new URL(`${endpoint}/${bucket}/${key}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(body);

    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${url.host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      "PUT",
      url.pathname,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const kDate = hmac(`AWS4${secretKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    await fetch(url.toString(), {
      method: "PUT",
      headers: {
        "content-type": contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        authorization,
      },
      body: new Uint8Array(body),
    });
  } catch {
    // Non-blocking if MinIO is offline
  }
}

function buildSampleArtworkSvg(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("instagram_post_01")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
      <defs>
        <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="55%" stop-color="#1E1B4B"/>
          <stop offset="100%" stop-color="#E11D48"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#bg1)"/>
      <circle cx="840" cy="240" r="190" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="40"/>
      <circle cx="840" cy="240" r="110" fill="#E11D48" fill-opacity="0.45"/>
      <rect x="84" y="84" width="240" height="52" rx="26" fill="#E11D48"/>
      <text x="204" y="118" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="22" font-weight="700" letter-spacing="2">ACME Q4 LAUNCH</text>
      <text x="84" y="540" fill="#F8FAFC" font-family="Georgia, serif" font-size="112">Precision</text>
      <text x="84" y="665" fill="#FCE7F3" font-family="Georgia, serif" font-style="italic" font-size="112">meets velocity.</text>
      <text x="84" y="760" fill="#CBD5E1" font-family="Inter, sans-serif" font-size="32">Introducing the next-gen Acme Studio workflow —</text>
      <text x="84" y="808" fill="#CBD5E1" font-family="Inter, sans-serif" font-size="32">engineered for zero creative drift.</text>
      <rect x="84" y="890" width="320" height="74" rx="37" fill="#F8FAFC"/>
      <text x="244" y="938" text-anchor="middle" fill="#0F172A" font-family="Inter, sans-serif" font-size="26" font-weight="700">Explore Q4 Drop →</text>
      <text x="996" y="938" text-anchor="end" fill="rgba(255,255,255,0.5)" font-family="monospace" font-size="24">01 / 03</text>
    </svg>`;
  }
  if (lower.includes("instagram_post_02")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
      <rect width="1080" height="1080" fill="#F8FAFC"/>
      <rect x="72" y="72" width="936" height="936" rx="48" fill="none" stroke="#0F172A" stroke-opacity="0.1" stroke-width="3"/>
      <circle cx="540" cy="410" r="175" fill="#E11D48"/>
      <circle cx="630" cy="410" r="145" fill="#0F172A" fill-opacity="0.9"/>
      <text x="120" y="155" fill="#E11D48" font-family="Inter, sans-serif" font-size="24" font-weight="700" letter-spacing="3">FEATURE SPOTLIGHT · 02</text>
      <text x="120" y="720" fill="#0F172A" font-family="Georgia, serif" font-size="96">Built for</text>
      <text x="120" y="828" fill="#E11D48" font-family="Georgia, serif" font-style="italic" font-size="96">modern teams.</text>
      <text x="120" y="910" fill="#475569" font-family="Inter, sans-serif" font-size="30">99.98% uptime · Real-time telemetry · Brand Red #E11D48</text>
    </svg>`;
  }
  if (lower.includes("banner")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
      <rect width="1600" height="900" fill="#0F172A"/>
      <circle cx="1280" cy="450" r="310" fill="#FF0033" fill-opacity="0.25"/>
      <circle cx="1280" cy="450" r="210" fill="#E11D48" fill-opacity="0.5"/>
      <rect x="110" y="110" width="280" height="48" rx="24" fill="rgba(255,255,255,0.1)"/>
      <text x="250" y="141" text-anchor="middle" fill="#F8FAFC" font-family="Inter, sans-serif" font-size="20" font-weight="600" letter-spacing="2">Q4 HERO CAMPAIGN</text>
      <text x="110" y="380" fill="#F8FAFC" font-family="Georgia, serif" font-size="118">The Future of</text>
      <text x="110" y="510" fill="#F8FAFC" font-family="Georgia, serif" font-style="italic" font-size="118">Acme Flagship.</text>
      <text x="110" y="610" fill="#94A3B8" font-family="Inter, sans-serif" font-size="32">Homepage Hero Banner · Revision v2 · 1600×900px</text>
      <rect x="110" y="680" width="340" height="82" rx="41" fill="#FF0033"/>
      <text x="280" y="731" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="28" font-weight="700">Pre-Order Now →</text>
    </svg>`;
  }
  if (lower.includes("logo")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
      <rect width="800" height="500" fill="#F8FAFC"/>
      <rect x="40" y="40" width="720" height="420" rx="24" fill="none" stroke="#CBD5E1" stroke-dasharray="8 8" stroke-width="2"/>
      <g transform="translate(220, 175)">
        <rect x="0" y="0" width="130" height="130" rx="34" fill="#E11D48"/>
        <path d="M65 28 L100 98 H30 Z" fill="#F8FAFC"/>
        <circle cx="65" cy="76" r="12" fill="#0F172A"/>
        <text x="160" y="88" fill="#0F172A" font-family="Inter, sans-serif" font-size="76" font-weight="800" letter-spacing="-2">ACME</text>
        <text x="164" y="122" fill="#64748B" font-family="monospace" font-size="18">PRIMARY LOCKUP · 24PX CLEAR SPACE</text>
      </g>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
    <rect width="1200" height="800" fill="#F4F1EA"/>
    <rect x="60" y="60" width="520" height="320" rx="28" fill="#0F172A"/>
    <text x="100" y="160" fill="#F8FAFC" font-family="Georgia, serif" font-size="52">Editorial</text>
    <text x="100" y="220" fill="#E11D48" font-family="Georgia, serif" font-style="italic" font-size="52">Contrast</text>
    <rect x="620" y="60" width="520" height="320" rx="28" fill="#E11D48"/>
    <text x="660" y="320" fill="#FFFFFF" font-family="monospace" font-size="28">#E11D48 · ACME RED</text>
    <rect x="60" y="420" width="1080" height="320" rx="28" fill="#E6DECF"/>
    <text x="105" y="560" fill="#141413" font-family="Georgia, serif" font-size="48">${fileName}</text>
    <text x="105" y="615" fill="#57544E" font-family="Inter, sans-serif" font-size="22">Acme Q4 Campaign Visual Asset · Synced with PixelHub</text>
  </svg>`;
}

const DEMO_EMAIL = "demo@pixelhub.dev";
const DEMO_CLIENT_EMAIL = "client@acme.com";
const DEMO_REQUESTER_EMAIL = "alex@lumina.io";
const DEMO_PASSWORD = "password123";
const PROJECT_SLUG = "acme-q4-campaign";
const SECOND_PROJECT_SLUG = "lumina-rebrand-2026";

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
  // Idempotent: clear child references before wiping the demo project + user.
  const existingProjects = await prisma.project.findMany({
    where: { slug: { in: [PROJECT_SLUG, SECOND_PROJECT_SLUG] } },
    select: { id: true },
  });
  for (const existing of existingProjects) {
    await prisma.project.update({
      where: { id: existing.id },
      data: { defaultBranchId: null },
    });
    await prisma.branch.updateMany({
      where: { projectId: existing.id },
      data: { headVersionId: null, parentBranchId: null },
    });
    await prisma.deliverable.updateMany({
      where: { requirement: { projectId: existing.id } },
      data: { satisfiedByFileId: null },
    });
    await prisma.brandLogo.deleteMany({
      where: { brandKit: { projectId: existing.id } },
    });
    await prisma.versionFile.deleteMany({
      where: { version: { branch: { projectId: existing.id } } },
    });
    await prisma.projectInvite.deleteMany({
      where: { projectId: existing.id },
    });
    await prisma.comment.deleteMany({ where: { projectId: existing.id } });
    await prisma.decision.deleteMany({ where: { projectId: existing.id } });
    await prisma.designSheetItem.deleteMany({
      where: { projectId: existing.id },
    });
    await prisma.brandCheckResult.deleteMany({
      where: { projectId: existing.id },
    });
    await prisma.requirementFileLink.deleteMany({
      where: { requirement: { projectId: existing.id } },
    });
    await prisma.task.deleteMany({ where: { projectId: existing.id } });
    await prisma.versionComparison.deleteMany({
      where: { projectId: existing.id },
    });
    await prisma.version.deleteMany({
      where: { branch: { projectId: existing.id } },
    });
    await prisma.file.deleteMany({ where: { projectId: existing.id } });
  }
  await prisma.project.deleteMany({
    where: { slug: { in: [PROJECT_SLUG, SECOND_PROJECT_SLUG] } },
  });
  await prisma.user.deleteMany({
    where: {
      email: { in: [DEMO_EMAIL, DEMO_CLIENT_EMAIL, DEMO_REQUESTER_EMAIL] },
    },
  });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Evan Parker",
      accountType: "DESIGNER",
      company: "Northstar Studio",
      title: "Lead Product Designer",
      passwordHash: hashPassword(DEMO_PASSWORD),
    },
  });

  const clientUser = await prisma.user.create({
    data: {
      email: DEMO_CLIENT_EMAIL,
      name: "Sarah Jenkins",
      accountType: "CLIENT",
      company: "Acme Corp",
      title: "VP of Brand & Marketing",
      passwordHash: hashPassword(DEMO_PASSWORD),
    },
  });

  const requesterUser = await prisma.user.create({
    data: {
      email: DEMO_REQUESTER_EMAIL,
      name: "Alex Rivera",
      accountType: "CLIENT",
      company: "Lumina Labs",
      title: "Head of Growth",
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
      members: {
        create: [
          {
            userId: user.id,
            role: "OWNER",
            canViewFiles: true,
            canDownloadFiles: true,
            canViewBrief: true,
            canComment: true,
            canApproveVersions: true,
          },
          {
            userId: clientUser.id,
            role: "CLIENT",
            invitedBy: user.id,
            canViewFiles: true,
            canDownloadFiles: true,
            canViewBrief: true,
            canComment: true,
            canApproveVersions: true,
          },
        ],
      },
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
    const svgContent = buildSampleArtworkSvg(fileName);
    const svgBuffer = Buffer.from(svgContent, "utf-8");
    const sha = sha256Hex(svgBuffer);
    const storageKey = `blobs/${sha.slice(0, 2)}/${sha.slice(2, 4)}/${sha}`;

    await uploadToMinio(storageKey, svgBuffer, "image/svg+xml");

    const file = await prisma.file.create({
      data: {
        projectId: project.id,
        branchId: spec.branchId,
        path: spec.path,
        fileName,
        extension,
        mimeType: "image/svg+xml",
        sizeBytes: BigInt(svgBuffer.byteLength),
        sha256: sha,
        storageKey,
        uploadedById: user.id,
        kind: spec.kind,
        imageMeta:
          spec.kind === "EXPORT"
            ? {
                width: fileName.includes("banner") ? 1600 : 1080,
                height: fileName.includes("banner") ? 900 : 1080,
                dominantColors:
                  fileName === "banner_v2.png"
                    ? ["#FF0033", "#0F172A"]
                    : ["#E11D48", "#F8FAFC"],
                fonts: ["Inter"],
              }
            : {
                width: 1200,
                height: 800,
                dominantColors: ["#E11D48", "#0F172A"],
              },
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

  // Pending AI Requirement Proposal for Designer Collaboration Hub
  await prisma.requirement.create({
    data: {
      projectId: project.id,
      title: "Q4 Launch Story Reels (Vertical 9:16)",
      description:
        "AI Proposal from brief: 2 vertical Instagram Story adaptations matching the Q4 hero gradient.",
      source: "AI_EXTRACTED",
      status: "PENDING",
      quantity: 2,
      priority: "MEDIUM",
      sortOrder: 4,
      dueDate: daysFromNow(9),
      deliverables: {
        create: [
          { name: "story_reel_01", filePatterns: ["story_reel_*.{png,jpg}"] },
          { name: "story_reel_02", filePatterns: ["story_reel_*.{png,jpg}"] },
        ],
      },
    },
  });

  // ---- Comments + Decision + Design Sheet ----
  const moodboardFile = files.find((f) => f.fileName === "moodboard-01.jpg")!;
  await prisma.designSheetItem.createMany({
    data: [
      {
        projectId: project.id,
        type: "IMAGE",
        title: "Q4 Moodboard & Texture Study",
        fileId: moodboardFile.id,
        boardGroup: "Moodboard",
        linkedRequirementId: igRequirement.id,
      },
      {
        projectId: project.id,
        type: "NOTE",
        title: "Campaign Direction",
        content:
          "Warm editorial aesthetic with high-contrast serif headlines and strict 24px logo clear space.",
        boardGroup: "Moodboard",
        linkedRequirementId: igRequirement.id,
      },
      {
        projectId: project.id,
        type: "COLOR",
        title: "Acme Primary Red",
        content: "#E11D48",
        boardGroup: "Moodboard",
        linkedRequirementId: bannerRequirement.id,
      },
      {
        projectId: project.id,
        type: "URL",
        title: "Q4 Launch Typography Spec",
        content: "https://rsms.me/inter/",
        boardGroup: "References",
        linkedRequirementId: logoRequirement.id,
      },
    ],
  });

  await prisma.comment.createMany({
    data: [
      {
        projectId: project.id,
        fileId: banner.id,
        versionId: v2.id,
        authorId: clientUser.id,
        body: "Can we shift the Pre-Order CTA button from hot pink (#FF0033) to our approved Acme Brand Red (#E11D48)?",
        anchorJson: { x: 0.22, y: 0.78 },
        status: "OPEN",
      },
      {
        projectId: project.id,
        fileId: ig1.id,
        versionId: v2.id,
        authorId: clientUser.id,
        body: "Love the 'Precision meets velocity' typography lockup here! Ready to approve once post 03 lands.",
        anchorJson: { x: 0.45, y: 0.55 },
        status: "OPEN",
      },
    ],
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

  // ---- Second Studio Project + Client Invitations & Access Requests ----
  const secondProject = await prisma.project.create({
    data: {
      name: "Lumina Rebrand 2026",
      slug: SECOND_PROJECT_SLUG,
      clientName: "Lumina Labs",
      description:
        "Complete visual identity, packaging system, and social launch kit.",
      deadline: daysFromNow(21),
      status: "ACTIVE",
      aiEnabled: true,
      members: { create: { userId: user.id, role: "OWNER" } },
      brandKit: { create: { name: "Lumina Brand Kit" } },
      branches: {
        create: [
          { name: "Main Concept", slug: "main", kind: "MAIN", status: "ACTIVE" },
        ],
      },
    },
    include: { branches: true },
  });

  await prisma.project.update({
    where: { id: secondProject.id },
    data: { defaultBranchId: secondProject.branches[0]!.id },
  });

  // 1) Incoming client access request for the Designer to review on /app
  await prisma.projectInvite.create({
    data: {
      projectId: project.id,
      email: requesterUser.email,
      userId: requesterUser.id,
      direction: "REQUEST",
      role: "CLIENT",
      status: "PENDING",
      message:
        "Hi Evan! Requesting client stakeholder access to review the Q4 social exports and hero banner.",
      canViewFiles: true,
      canDownloadFiles: false,
      canViewBrief: true,
      canComment: true,
      canApproveVersions: true,
    },
  });

  // 2) Pending project invitation waiting for the Demo Client (client@acme.com) on /app
  await prisma.projectInvite.create({
    data: {
      projectId: secondProject.id,
      email: clientUser.email,
      userId: clientUser.id,
      invitedById: user.id,
      direction: "INVITE",
      role: "CLIENT",
      status: "PENDING",
      message:
        "Invited you to preview our upcoming Lumina Rebrand 2026 deliverables and leave early feedback.",
      canViewFiles: true,
      canDownloadFiles: true,
      canViewBrief: true,
      canComment: true,
      canApproveVersions: true,
    },
  });

  console.log("Seed complete.");
  console.log(`  designer: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  client:   ${DEMO_CLIENT_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  project:  ${project.name} (/p/${project.slug})`);
  console.log(`  files:    ${files.length}`);
  console.log(`  requirements: ${[igRequirement, bannerRequirement, logoRequirement, newsletterRequirement].length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
