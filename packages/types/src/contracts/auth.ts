import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const magicLinkSchema = z.object({
  email: z.string().email().max(320),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
