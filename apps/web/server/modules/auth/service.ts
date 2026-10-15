import { randomInt } from "node:crypto";
import type {
  ChangePasswordInput,
  LoginInput,
  MagicLinkInput,
  ResetPasswordInput,
  SendOtpInput,
  SignupInput,
  UpdateProfileInput,
} from "@pixelhub/types/contracts/auth";
import { AppError } from "../../errors";
import { prisma } from "../../db";
import { sendOtpEmail } from "../../email";
import { hashPassword, verifyPassword } from "../../auth/password";
import {
  createSession,
  generateToken,
  hashToken,
} from "../../auth/session";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

export async function sendEmailOtp(input: SendOtpInput) {
  const email = input.email.trim().toLowerCase();

  if (input.purpose === "SIGNUP") {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw AppError.conflict(
        "EMAIL_TAKEN",
        "An account with this email already exists",
      );
    }
  } else {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing || existing.deletedAt) {
      throw AppError.notFound("Account with that email address");
    }
  }

  const otp = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Persist in PostgreSQL so OTP works across all Next.js workers & hot-reloads
  await prisma.emailOtp.upsert({
    where: {
      email_purpose: { email, purpose: input.purpose },
    },
    create: {
      email,
      purpose: input.purpose,
      codeHash: hashToken(otp),
      attempts: 0,
      expiresAt,
    },
    update: {
      codeHash: hashToken(otp),
      attempts: 0,
      expiresAt,
    },
  });

  const delivery = await sendOtpEmail({
    to: email,
    otp,
    purpose: input.purpose,
  });

  console.info(
    `[pixelhub-otp] ${input.purpose} code for ${email}: ${otp} (provider=${delivery.provider}${delivery.previewUrl ? `, preview=${delivery.previewUrl}` : ""})`,
  );

  return {
    sent: true,
    email,
    purpose: input.purpose,
    expiresInSeconds: 600,
    provider: delivery.provider,
    previewUrl: delivery.previewUrl,
    devOtp: otp,
  };
}

async function verifyEmailOtpOrThrow(
  email: string,
  purpose: "SIGNUP" | "RESET_PASSWORD",
  otp: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const record = await prisma.emailOtp.findUnique({
    where: {
      email_purpose: { email: normalizedEmail, purpose },
    },
  });

  if (!record || record.expiresAt < new Date()) {
    if (record) {
      await prisma.emailOtp
        .delete({ where: { id: record.id } })
        .catch(() => undefined);
    }
    throw AppError.badRequest(
      "OTP_EXPIRED",
      "Your verification code has expired or was not requested. Please click Resend OTP.",
    );
  }

  if (record.attempts >= 5) {
    await prisma.emailOtp
      .delete({ where: { id: record.id } })
      .catch(() => undefined);
    throw AppError.badRequest(
      "OTP_MAX_ATTEMPTS",
      "Too many incorrect attempts. Please request a new OTP code.",
    );
  }

  if (record.codeHash !== hashToken(otp.trim())) {
    await prisma.emailOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw AppError.badRequest(
      "OTP_INVALID",
      "Invalid 6-digit verification code. Please check the code and try again.",
    );
  }

  await prisma.emailOtp.delete({ where: { id: record.id } });
}

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  accountType: "DESIGNER" | "CLIENT";
  company: string | null;
  title: string | null;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountType: user.accountType,
    company: user.company,
    title: user.title,
    avatarUrl: user.avatarUrl,
  };
}

export async function signup(input: SignupInput) {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict("EMAIL_TAKEN", "An account with this email already exists");
  }

  await verifyEmailOtpOrThrow(email, "SIGNUP", input.otp);

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      accountType: input.accountType ?? "DESIGNER",
      company: input.company?.trim() || null,
      title: input.title?.trim() || null,
      passwordHash: hashPassword(input.password),
    },
  });

  // Link any existing pending invitations sent to this email address
  await prisma.projectInvite.updateMany({
    where: { email, userId: null },
    data: { userId: user.id },
  });

  const session = await createSession(user.id);
  return { user: publicUser(user), ...session };
}

export async function login(input: LoginInput) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.deletedAt || !verifyPassword(input.password, user.passwordHash)) {
    throw new AppError("INVALID_CREDENTIALS", "Incorrect email or password", 401);
  }

  const session = await createSession(user.id);
  return { user: publicUser(user), ...session };
}

export async function requestMagicLink(input: MagicLinkInput) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.deletedAt) {
    const token = generateToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
      },
    });
    const url = `${process.env.APP_URL ?? "http://localhost:3000"}/auth/magic?token=${token}`;
    // TODO: deliver via the email provider. Logged for local development.
    console.info(`[pixelhub] magic link for ${email}: ${url}`);
  }

  // Always respond the same way to avoid leaking account existence.
  return { sent: true };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) throw AppError.unauthorized();

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: { select: { id: true, name: true, slug: true, status: true } },
    },
  });

  return {
    user: publicUser(user),
    memberships: memberships.map((member) => ({
      ...member.project,
      role: member.role,
      canViewFiles: member.canViewFiles,
      canDownloadFiles: member.canDownloadFiles,
      canViewBrief: member.canViewBrief,
      canComment: member.canComment,
      canApproveVersions: member.canApproveVersions,
    })),
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  let normalizedEmail: string | undefined;
  if (input.email !== undefined) {
    normalizedEmail = input.email.trim().toLowerCase();
    const conflict = await prisma.user.findFirst({
      where: { email: normalizedEmail, id: { not: userId } },
    });
    if (conflict) {
      throw AppError.conflict(
        "EMAIL_TAKEN",
        "Another account is already using this email address",
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
      ...(input.company !== undefined
        ? { company: input.company?.trim() || null }
        : {}),
      ...(input.title !== undefined
        ? { title: input.title?.trim() || null }
        : {}),
    },
  });
  return { user: publicUser(user) };
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw AppError.unauthorized();

  if (
    input.currentPassword &&
    !verifyPassword(input.currentPassword, user.passwordHash)
  ) {
    throw AppError.badRequest(
      "INVALID_PASSWORD",
      "Your current password is incorrect",
    );
  }

  await verifyEmailOtpOrThrow(user.email, "RESET_PASSWORD", input.otp);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(input.newPassword) },
  });

  return { ok: true };
}

export async function resetPasswordWithOtp(input: ResetPasswordInput) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    throw AppError.notFound("Account with that email address");
  }

  await verifyEmailOtpOrThrow(email, "RESET_PASSWORD", input.otp);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.newPassword) },
  });

  const session = await createSession(updated.id);
  return { user: publicUser(updated), ...session };
}
