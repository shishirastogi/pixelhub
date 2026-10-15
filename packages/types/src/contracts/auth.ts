import { z } from "zod";
import { AccountType } from "../enums";

export const sendOtpSchema = z.object({
  email: z.string().email().max(320),
  purpose: z.enum(["SIGNUP", "RESET_PASSWORD"]),
});
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const signupSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
  otp: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit OTP code"),
  accountType: z.nativeEnum(AccountType).optional(),
  company: z.string().max(120).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(320).optional(),
  company: z.string().max(120).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200).optional(),
  otp: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit OTP code"),
  newPassword: z.string().min(8).max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().email().max(320),
  otp: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit OTP code"),
  newPassword: z.string().min(8).max(200),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const magicLinkSchema = z.object({
  email: z.string().email().max(320),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
