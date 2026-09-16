import type {
  LoginInput,
  MagicLinkInput,
  SignupInput,
} from "@pixelhub/types/contracts/auth";
import { AppError } from "../../errors";
import { prisma } from "../../db";
import { hashPassword, verifyPassword } from "../../auth/password";
import {
  createSession,
  generateToken,
  hashToken,
} from "../../auth/session";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}) {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
}

export async function signup(input: SignupInput) {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict("EMAIL_TAKEN", "An account with this email already exists");
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: hashPassword(input.password),
    },
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
    })),
  };
}
