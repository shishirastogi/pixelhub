import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ALL_ROLES, requireRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { getObjectBuffer } from "@/server/storage";

function renderSampleSvg(fileName: string, kind: string): string {
  const lower = fileName.toLowerCase();

  if (lower.includes("instagram_post_01")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
      <defs>
        <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="55%" stop-color="#1E1B4B"/>
          <stop offset="100%" stop-color="#E11D48"/>
        </linearGradient>
        <radialGradient id="glow1" cx="78%" cy="24%" r="50%">
          <stop offset="0%" stop-color="#F43F5E" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="#0F172A" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#bg1)"/>
      <rect width="1080" height="1080" fill="url(#glow1)"/>
      <circle cx="840" cy="240" r="190" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="40"/>
      <circle cx="840" cy="240" r="110" fill="#E11D48" fill-opacity="0.45"/>
      <rect x="84" y="84" width="240" height="52" rx="26" fill="#E11D48"/>
      <text x="204" y="118" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="22" font-weight="700" letter-spacing="2">ACME Q4 LAUNCH</text>
      <text x="84" y="540" fill="#F8FAFC" font-family="Georgia, serif" font-size="112" font-weight="400">Precision</text>
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
      <defs>
        <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F8FAFC"/>
          <stop offset="50%" stop-color="#F1F5F9"/>
          <stop offset="100%" stop-color="#FFE4E6"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#bg2)"/>
      <rect x="72" y="72" width="936" height="936" rx="48" fill="none" stroke="#0F172A" stroke-opacity="0.1" stroke-width="3"/>
      <circle cx="540" cy="410" r="175" fill="#E11D48"/>
      <circle cx="630" cy="410" r="145" fill="#0F172A" fill-opacity="0.9"/>
      <text x="120" y="155" fill="#E11D48" font-family="Inter, sans-serif" font-size="24" font-weight="700" letter-spacing="3">FEATURE SPOTLIGHT · 02</text>
      <text x="120" y="720" fill="#0F172A" font-family="Georgia, serif" font-size="96">Built for</text>
      <text x="120" y="828" fill="#E11D48" font-family="Georgia, serif" font-style="italic" font-size="96">modern teams.</text>
      <text x="120" y="910" fill="#475569" font-family="Inter, sans-serif" font-size="30">99.98% uptime · Real-time telemetry · Brand Red #E11D48</text>
    </svg>`;
  }

  if (lower.includes("instagram_post_03")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
      <defs>
        <linearGradient id="bg3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#E11D48"/>
          <stop offset="100%" stop-color="#881337"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#bg3)"/>
      <circle cx="540" cy="540" r="390" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      <text x="540" y="450" text-anchor="middle" fill="#FFFFFF" font-family="Georgia, serif" font-size="116">Available</text>
      <text x="540" y="580" text-anchor="middle" fill="#FFE4E6" font-family="Georgia, serif" font-style="italic" font-size="116">Worldwide.</text>
      <rect x="340" y="680" width="400" height="80" rx="40" fill="#0F172A"/>
      <text x="540" y="730" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="28" font-weight="700">acme.com/q4-launch</text>
    </svg>`;
  }

  if (lower.includes("banner")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
      <defs>
        <linearGradient id="bannerBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="52%" stop-color="#1E293B"/>
          <stop offset="100%" stop-color="#31102F"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bannerBg)"/>
      <circle cx="1280" cy="450" r="310" fill="#FF0033" fill-opacity="0.22"/>
      <circle cx="1280" cy="450" r="210" fill="#E11D48" fill-opacity="0.45"/>
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

  if (lower.includes("moodboard")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
      <rect width="1200" height="800" fill="#F4F1EA"/>
      <rect x="60" y="60" width="520" height="320" rx="28" fill="#0F172A"/>
      <text x="100" y="160" fill="#F8FAFC" font-family="Georgia, serif" font-size="52">Editorial</text>
      <text x="100" y="220" fill="#E11D48" font-family="Georgia, serif" font-style="italic" font-size="52">Contrast</text>
      <rect x="620" y="60" width="520" height="320" rx="28" fill="#E11D48"/>
      <text x="660" y="320" fill="#FFFFFF" font-family="monospace" font-size="28">#E11D48 · ACME RED</text>
      <rect x="60" y="420" width="340" height="320" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
      <text x="95" y="540" fill="#0F172A" font-family="Inter, sans-serif" font-size="64" font-weight="700">Aa Bb</text>
      <text x="95" y="600" fill="#64748B" font-family="Inter, sans-serif" font-size="24">Inter + Instrument Serif</text>
      <rect x="430" y="420" width="710" height="320" rx="28" fill="#E6DECF"/>
      <circle cx="960" cy="580" r="110" fill="#F4C95D"/>
      <text x="475" y="560" fill="#141413" font-family="Georgia, serif" font-size="48">Q4 Moodboard &amp; Texture Study</text>
      <text x="475" y="615" fill="#57544E" font-family="Inter, sans-serif" font-size="22">Warm stone neutrals paired with high-energy crimson accents</text>
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" width="960" height="640">
    <defs>
      <linearGradient id="defBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#141413"/>
        <stop offset="100%" stop-color="#2E1065"/>
      </linearGradient>
    </defs>
    <rect width="960" height="640" fill="url(#defBg)"/>
    <rect x="60" y="60" width="840" height="520" rx="32" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    <rect x="100" y="100" width="180" height="44" rx="22" fill="#9FE830"/>
    <text x="190" y="129" text-anchor="middle" fill="#141413" font-family="Inter, sans-serif" font-size="18" font-weight="700">${kind}</text>
    <text x="100" y="320" fill="#FFFFFF" font-family="Georgia, serif" font-size="64">${fileName.replace(/[<>&"']/g, "")}</text>
    <text x="100" y="385" fill="#A1A1AA" font-family="monospace" font-size="24">PixelHub Content-Addressed Asset Preview</text>
  </svg>`;
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const user = await requireUser(req);
    const file = await prisma.file.findUnique({
      where: { id: context.params.id },
    });
    if (!file || file.deletedAt) {
      return new NextResponse("Not found", { status: 404 });
    }

    const membership = await requireRole(user.id, file.projectId, ALL_ROLES);
    if (!membership.canViewFiles) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const ext = file.extension.toLowerCase();
    const isRasterOrSvg = [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "svg",
      "avif",
    ].includes(ext);

    if (isRasterOrSvg) {
      const storedBuffer = await getObjectBuffer(file.storageKey);
      if (storedBuffer && storedBuffer.length > 0) {
        return new NextResponse(new Uint8Array(storedBuffer), {
          status: 200,
          headers: {
            "content-type": file.mimeType || "image/png",
            "cache-control": "private, max-age=300",
          },
        });
      }
    }

    const svg = renderSampleSvg(file.fileName, file.kind);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
