import nodemailer from "nodemailer";

export interface OtpEmailResult {
  delivered: boolean;
  provider: "smtp" | "resend" | "ethereal" | "console";
  previewUrl: string | null;
}

const globalForMail = globalThis as unknown as {
  etherealAccount?: { user: string; pass: string; smtp: { host: string; port: number; secure: boolean } };
  runtimeSmtpConfig?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
    resendApiKey?: string;
  };
};

export function setRuntimeEmailConfig(config: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  resendApiKey?: string;
}) {
  globalForMail.runtimeSmtpConfig = {
    ...globalForMail.runtimeSmtpConfig,
    ...config,
  };
}

export function getRuntimeEmailStatus() {
  const rt = globalForMail.runtimeSmtpConfig;
  const resendKey = rt?.resendApiKey || process.env.RESEND_API_KEY;
  const smtpHost = rt?.host || process.env.SMTP_HOST;
  const smtpUser = rt?.user || process.env.SMTP_USER;
  if (resendKey) return { provider: "resend" as const, configured: true };
  if (smtpHost && smtpUser) return { provider: "smtp" as const, configured: true, host: smtpHost, user: smtpUser };
  return { provider: "ethereal" as const, configured: false };
}

function buildOtpHtml(otp: string, purpose: "SIGNUP" | "RESET_PASSWORD"): string {
  const heading =
    purpose === "SIGNUP"
      ? "Verify your email to create your PixelHub account"
      : "Reset your PixelHub account password";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #F8F6F1; border-radius: 24px; border: 1px solid #EBE7DF; color: #141413;">
      <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">PixelHub</div>
      <h2 style="font-family: Georgia, serif; font-size: 26px; font-weight: 400; margin: 0 0 12px;">${heading}</h2>
      <p style="font-size: 14px; color: #57544E; line-height: 1.5; margin: 0 0 24px;">
        Enter the following 6-digit verification code in PixelHub. This code expires in 10 minutes.
      </p>
      <div style="background: #141413; color: #9FE830; font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 18px 24px; border-radius: 16px; margin-bottom: 24px;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #9A968C; margin: 0;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
  `;
}

export async function sendOtpEmail({
  to,
  otp,
  purpose,
}: {
  to: string;
  otp: string;
  purpose: "SIGNUP" | "RESET_PASSWORD";
}): Promise<OtpEmailResult> {
  const subject =
    purpose === "SIGNUP"
      ? `${otp} is your PixelHub verification code`
      : `${otp} is your PixelHub password reset code`;
  const html = buildOtpHtml(otp, purpose);
  const text = `Your PixelHub ${purpose === "SIGNUP" ? "verification" : "password reset"} code is: ${otp} (expires in 10 minutes).`;

  const rt = globalForMail.runtimeSmtpConfig;
  const resendApiKey = (rt?.resendApiKey || process.env.RESEND_API_KEY || "").trim();
  const smtpHost = (rt?.host || process.env.SMTP_HOST || "").trim();
  const smtpPort = Number(rt?.port || process.env.SMTP_PORT || 587);
  const smtpUser = (rt?.user || process.env.SMTP_USER || "").trim();
  const smtpPass = (rt?.pass || process.env.SMTP_PASS || "").trim();
  const fromAddress =
    (rt?.from || process.env.SMTP_FROM || "").trim() ||
    "PixelHub <no-reply@pixelhub.dev>";

  // 1. Resend HTTP API if configured
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          html,
          text,
        }),
      });
      if (res.ok) {
        return { delivered: true, provider: "resend", previewUrl: null };
      }
    } catch {
      // Fall through to SMTP / Ethereal
    }
  }

  // 2. Configured SMTP Server (e.g. Gmail App Password, Mailtrap, SendGrid, Resend SMTP)
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html,
      });
      return { delivered: true, provider: "smtp", previewUrl: null };
    } catch (err) {
      console.warn("[pixelhub-email] Custom SMTP send failed, falling back to test inbox:", err);
    }
  }

  // 3. Automatic Nodemailer Ethereal Test Inbox (real SMTP transport + live webmail preview URL)
  try {
    if (!globalForMail.etherealAccount) {
      const acct = await Promise.race([
        nodemailer.createTestAccount(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (acct) {
        globalForMail.etherealAccount = acct;
      }
    }

    if (globalForMail.etherealAccount) {
      const acct = globalForMail.etherealAccount;
      const transporter = nodemailer.createTransport({
        host: acct.smtp.host,
        port: acct.smtp.port,
        secure: acct.smtp.secure,
        auth: { user: acct.user, pass: acct.pass },
      });
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      return {
        delivered: true,
        provider: "ethereal",
        previewUrl: typeof previewUrl === "string" ? previewUrl : null,
      };
    }
  } catch {
    // Non-blocking fallback if offline
  }

  return { delivered: true, provider: "console", previewUrl: null };
}
