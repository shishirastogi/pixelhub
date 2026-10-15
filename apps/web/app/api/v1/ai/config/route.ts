import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getActiveAiConfig, setRuntimeAiConfig } from "@/server/ai/provider";
import { getRuntimeEmailStatus, setRuntimeEmailConfig } from "@/server/email";
import { requireUser } from "@/server/auth/session";

const updateConfigSchema = z.object({
  groqApiKey: z.string().optional(),
  groqModel: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
  resendApiKey: z.string().optional(),
});

async function persistEnvUpdates(updates: Record<string, string>) {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    let content = "";
    try {
      content = await readFile(envPath, "utf-8");
    } catch {
      content = "";
    }

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      const line = `${key}="${value.replace(/"/g, "")}"`;
      if (regex.test(content)) {
        content = content.replace(regex, line);
      } else {
        content = `${content.trimEnd()}\n${line}\n`;
      }
    }

    await writeFile(envPath, content, "utf-8");
  } catch {
    // Non-blocking if filesystem is read-only
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const ai = getActiveAiConfig();
    const email = getRuntimeEmailStatus();
    return NextResponse.json({
      ai: {
        provider: ai.provider,
        configured: ai.configured,
        model: ai.defaultModel,
        maskedKey: ai.apiKey
          ? `${ai.apiKey.slice(0, 7)}••••••••${ai.apiKey.slice(-4)}`
          : null,
      },
      email,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const body = updateConfigSchema.parse(await req.json());

    const envUpdates: Record<string, string> = {};
    if (body.groqApiKey !== undefined) {
      setRuntimeAiConfig({
        groqApiKey: body.groqApiKey.trim(),
        ...(body.groqModel ? { groqModel: body.groqModel.trim() } : {}),
      });
      envUpdates.GROQ_API_KEY = body.groqApiKey.trim();
      envUpdates.AI_PROVIDER = "groq";
    }
    if (body.groqModel !== undefined) {
      setRuntimeAiConfig({ groqModel: body.groqModel.trim() });
      envUpdates.GROQ_MODEL_DEFAULT = body.groqModel.trim();
    }

    if (
      body.smtpHost !== undefined ||
      body.smtpUser !== undefined ||
      body.smtpPass !== undefined ||
      body.resendApiKey !== undefined
    ) {
      setRuntimeEmailConfig({
        host: body.smtpHost?.trim(),
        port: body.smtpPort,
        user: body.smtpUser?.trim(),
        pass: body.smtpPass?.trim(),
        from: body.smtpFrom?.trim(),
        resendApiKey: body.resendApiKey?.trim(),
      });
      if (body.smtpHost !== undefined) envUpdates.SMTP_HOST = body.smtpHost.trim();
      if (body.smtpPort !== undefined) envUpdates.SMTP_PORT = String(body.smtpPort);
      if (body.smtpUser !== undefined) envUpdates.SMTP_USER = body.smtpUser.trim();
      if (body.smtpPass !== undefined) envUpdates.SMTP_PASS = body.smtpPass.trim();
      if (body.smtpFrom !== undefined) envUpdates.SMTP_FROM = body.smtpFrom.trim();
      if (body.resendApiKey !== undefined) {
        envUpdates.RESEND_API_KEY = body.resendApiKey.trim();
      }
    }

    if (Object.keys(envUpdates).length > 0) {
      await persistEnvUpdates(envUpdates);
    }

    const ai = getActiveAiConfig();
    const email = getRuntimeEmailStatus();
    return NextResponse.json({
      ok: true,
      ai: {
        provider: ai.provider,
        configured: ai.configured,
        model: ai.defaultModel,
        maskedKey: ai.apiKey
          ? `${ai.apiKey.slice(0, 7)}••••••••${ai.apiKey.slice(-4)}`
          : null,
      },
      email,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIG_ERROR",
          message: err instanceof Error ? err.message : "Failed to save config",
        },
      },
      { status: 400 },
    );
  }
}
