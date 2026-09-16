import {
  loginSchema,
  magicLinkSchema,
  signupSchema,
} from "@pixelhub/types/contracts/auth";
import { json, parseBody, type RouteCtx } from "../../http";
import {
  clearSessionCookie,
  destroySession,
  getSessionToken,
  requireUser,
  sessionCookie,
} from "../../auth/session";
import * as service from "./service";

export async function signup(ctx: RouteCtx) {
  const input = await parseBody(ctx.req, signupSchema);
  const { user, token, expiresAt } = await service.signup(input);
  const response = json({ user }, 201);
  response.headers.append("set-cookie", sessionCookie(token, expiresAt));
  return response;
}

export async function login(ctx: RouteCtx) {
  const input = await parseBody(ctx.req, loginSchema);
  const { user, token, expiresAt } = await service.login(input);
  const response = json({ user });
  response.headers.append("set-cookie", sessionCookie(token, expiresAt));
  return response;
}

export async function magicLink(ctx: RouteCtx) {
  const input = await parseBody(ctx.req, magicLinkSchema);
  return service.requestMagicLink(input);
}

export async function logout(ctx: RouteCtx) {
  const token = getSessionToken(ctx.req);
  if (token) await destroySession(token);
  const response = json({ ok: true });
  response.headers.append("set-cookie", clearSessionCookie());
  return response;
}

export async function me(ctx: RouteCtx) {
  const user = await requireUser(ctx.req);
  return service.getMe(user.id);
}
