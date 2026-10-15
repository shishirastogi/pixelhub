import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { prisma } from "../db";
import { AppError } from "../errors";

export const SESSION_COOKIE = "pixelhub_session";
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  accountType: "DESIGNER" | "CLIENT";
  company: string | null;
  title: string | null;
  avatarUrl: string | null;
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  ttlMs: number = SESSION_TTL_MS,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.session.create({ data: { userId, token: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

/**
 * `Secure` is only set when the app is served over HTTPS (per APP_URL).
 * Keying off NODE_ENV alone breaks local `next start` over http://localhost,
 * because the browser refuses to send Secure cookies over plain HTTP.
 */
function cookieSecurity(): string {
  return (process.env.APP_URL ?? "").startsWith("https://") ? "; Secure" : "";
}

export function sessionCookie(token: string, expiresAt: Date): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${cookieSecurity()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecurity()}`;
}

export function getSessionToken(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export async function sessionUserFromToken(
  token: string | null,
): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || session.user.deletedAt) {
    return null;
  }

  const { id, email, name, accountType, company, title, avatarUrl } = session.user;
  return { id, email, name, accountType, company, title, avatarUrl };
}

export async function optionalUser(req: NextRequest): Promise<SessionUser | null> {
  return sessionUserFromToken(getSessionToken(req));
}

/** Server-component variant: reads the session cookie via next/headers. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value ?? null;
  return sessionUserFromToken(token);
}

/** Server-component guard: redirects to /login when unauthenticated. */
export async function requireCurrentUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireUser(req: NextRequest): Promise<SessionUser> {
  const user = await optionalUser(req);
  if (!user) throw AppError.unauthorized();
  return user;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token: hashToken(token) } });
}

/** Watcher tokens are stored hashed (docs/06-file-watcher.md §9). */
export function hashWatcherToken(token: string): string {
  return hashToken(token);
}
