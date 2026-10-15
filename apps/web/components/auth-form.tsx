"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { Button, ErrorText, Field, Input } from "@/components/form";

interface SendOtpResponse {
  sent: boolean;
  email: string;
  expiresInSeconds: number;
  provider?: string;
  previewUrl?: string | null;
  devOtp?: string;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const isLogin = mode === "login";

  const [accountType, setAccountType] = useState<"DESIGNER" | "CLIENT">(
    "DESIGNER",
  );
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState(isLogin ? "demo@pixelhub.dev" : "");
  const [password, setPassword] = useState(isLogin ? "password123" : "");

  // Signup OTP state
  const [signupStep, setSignupStep] = useState<"DETAILS" | "OTP">("DETAILS");
  const [otp, setOtp] = useState("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [otpPreviewUrl, setOtpPreviewUrl] = useState<string | null>(null);

  // Forgot Password / Reset OTP state (on login page)
  const [forgotMode, setForgotMode] = useState(false);
  const [resetStep, setResetStep] = useState<"EMAIL" | "VERIFY">("EMAIL");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(purpose: "SIGNUP" | "RESET_PASSWORD") {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await apiFetch<SendOtpResponse>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          purpose,
        }),
      });
      setDevOtpHint(res.devOtp ?? null);
      setOtpPreviewUrl(res.previewUrl ?? null);
      setOtp(res.devOtp ?? "");
      if (purpose === "SIGNUP") {
        setSignupStep("OTP");
        setNote(`6-digit verification code generated for ${res.email}.`);
      } else {
        setResetStep("VERIFY");
        setNote(`6-digit password reset code generated for ${res.email}.`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send verification code",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNote(null);

    // 1. Forgot Password Flow
    if (isLogin && forgotMode) {
      if (resetStep === "EMAIL") {
        await requestOtp("RESET_PASSWORD");
        return;
      }
      if (otp.trim().length !== 6) {
        setError("Enter the 6-digit OTP code sent to your email.");
        return;
      }
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
      setBusy(true);
      try {
        await apiFetch("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            otp: otp.trim(),
            newPassword,
          }),
        });
        router.push("/app");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to reset password",
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    // 2. Standard Login Flow
    if (isLogin) {
      setBusy(true);
      try {
        await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        router.push("/app");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
      return;
    }

    // 3. Signup Flow (Step 1: Send OTP -> Step 2: Verify OTP & Create Account)
    if (signupStep === "DETAILS") {
      if (!name.trim()) {
        setError("Full name is required.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      await requestOtp("SIGNUP");
      return;
    }

    if (otp.trim().length !== 6) {
      setError("Enter the 6-digit OTP verification code.");
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          otp: otp.trim(),
          accountType,
          company: company.trim() || null,
          title: title.trim() || null,
        }),
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pixelhub_show_onboarding", "true");
      }
      router.push("/app?welcome=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  // Render Forgot Password Mode on Login Page
  if (isLogin && forgotMode) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl bg-[#FAF8F4] px-3.5 py-2.5">
          <span className="text-xs font-semibold text-[#141413]">
            Reset Password via Email OTP
          </span>
          <button
            type="button"
            onClick={() => {
              setForgotMode(false);
              setResetStep("EMAIL");
              setError(null);
              setNote(null);
            }}
            className="text-xs font-medium text-[#6B6860] underline hover:text-[#141413]"
          >
            ← Back to Sign in
          </button>
        </div>

        <Field label="Account Email Address">
          <Input
            type="email"
            value={email}
            disabled={resetStep === "VERIFY"}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@studio.com"
          />
        </Field>

        {resetStep === "VERIFY" ? (
          <>
            {devOtpHint ? (
              <div className="space-y-1.5 rounded-2xl border border-[#9FE830] bg-[#9FE830]/20 px-3.5 py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span>
                    OTP Code for <strong>{email}</strong>:{" "}
                    <code className="font-mono text-sm font-bold text-[#141413]">
                      {devOtpHint}
                    </code>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtpHint)}
                    className="rounded-full bg-[#141413] px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    Auto-fill OTP
                  </button>
                </div>
                {otpPreviewUrl ? (
                  <a
                    href={otpPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-semibold text-[#6D28D9] underline"
                  >
                    Open Sent Email in Nodemailer Inbox ↗
                  </a>
                ) : null}
              </div>
            ) : null}

            <Field
              label="6-Digit Email OTP Code"
              hint="Enter the 6-digit verification code sent to your email."
            >
              <Input
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                maxLength={6}
                className="font-mono text-base tracking-[0.3em]"
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="New Password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  placeholder="Min 8 chars"
                  required
                />
              </Field>
              <Field label="Confirm Password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  placeholder="Repeat password"
                  required
                />
              </Field>
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                disabled={busy}
                onClick={() => void requestOtp("RESET_PASSWORD")}
                className="font-medium text-[#6D28D9] underline"
              >
                Resend OTP code
              </button>
              <button
                type="button"
                onClick={() => setResetStep("EMAIL")}
                className="text-[#6B6860] underline"
              >
                Change email
              </button>
            </div>
          </>
        ) : null}

        {error ? <ErrorText>{error}</ErrorText> : null}
        {note ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            {note}
          </p>
        ) : null}

        <Button type="submit" disabled={busy} className="w-full py-2.5">
          {busy
            ? "Please wait…"
            : resetStep === "EMAIL"
              ? "Send 6-Digit Reset OTP →"
              : "Verify OTP & Reset Password"}
        </Button>
      </form>
    );
  }

  // Render Signup Step 2: Email OTP Verification
  if (!isLogin && signupStep === "OTP") {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-4">
          <div className="flex items-center justify-between">
            <Badge tone="lime">Step 2 of 2 · Email OTP Verification</Badge>
            <button
              type="button"
              onClick={() => {
                setSignupStep("DETAILS");
                setError(null);
              }}
              className="text-xs font-medium text-[#6B6860] underline hover:text-[#141413]"
            >
              ← Edit details
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#57544E]">
            We sent a 6-digit verification code to{" "}
            <strong className="text-[#141413]">{email}</strong>. Enter the code
            below to verify your email and create your{" "}
            <strong>{accountType}</strong> account.
          </p>
        </div>

        {devOtpHint ? (
          <div className="space-y-1.5 rounded-2xl border border-[#9FE830] bg-[#9FE830]/20 px-3.5 py-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span>
                OTP Code for <strong>{email}</strong>:{" "}
                <code className="font-mono text-sm font-bold text-[#141413]">
                  {devOtpHint}
                </code>
              </span>
              <button
                type="button"
                onClick={() => setOtp(devOtpHint)}
                className="rounded-full bg-[#141413] px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                Auto-fill OTP
              </button>
            </div>
            {otpPreviewUrl ? (
              <a
                href={otpPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-semibold text-[#6D28D9] underline"
              >
                Open Sent Email in Nodemailer Inbox ↗
              </a>
            ) : null}
          </div>
        ) : null}

        <Field
          label="6-Digit Verification OTP"
          hint="Expires in 10 minutes"
        >
          <Input
            autoFocus
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            maxLength={6}
            className="font-mono text-lg tracking-[0.35em]"
            required
          />
        </Field>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestOtp("SIGNUP")}
            className="font-medium text-[#6D28D9] underline"
          >
            Resend verification code
          </button>
        </div>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {note ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            {note}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={busy || otp.length !== 6}
          className="w-full py-2.5"
        >
          {busy ? "Verifying & Creating…" : "Verify OTP & Create Account →"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isLogin ? (
        <div className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#6B6860]">
            Quick Demo Account Switcher
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail("demo@pixelhub.dev");
                setPassword("password123");
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-xs transition",
                email === "demo@pixelhub.dev"
                  ? "border-[#141413] bg-[#141413] text-white"
                  : "border-[#EBE7DF] bg-white text-[#141413] hover:bg-[#F3F1EC]",
              )}
            >
              <span className="block font-semibold">Demo Designer</span>
              <span className="block truncate text-[11px] opacity-75">
                demo@pixelhub.dev
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("client@acme.com");
                setPassword("password123");
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-xs transition",
                email === "client@acme.com"
                  ? "border-[#141413] bg-[#141413] text-white"
                  : "border-[#EBE7DF] bg-white text-[#141413] hover:bg-[#F3F1EC]",
              )}
            >
              <span className="block font-semibold">Demo Client</span>
              <span className="block truncate text-[11px] opacity-75">
                client@acme.com
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#6B6860]">
            Are you signing up as a Designer or a Client? (Permanent)
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setAccountType("DESIGNER")}
              className={cn(
                "flex flex-col justify-between rounded-2xl border p-3.5 text-left transition",
                accountType === "DESIGNER"
                  ? "border-[#141413] bg-[#141413] text-white shadow-pill"
                  : "border-[#EBE7DF] bg-[#FAF8F4] text-[#141413] hover:bg-white",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  Designer / Studio
                </span>
                <span
                  className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                    accountType === "DESIGNER"
                      ? "bg-[#9FE830] text-[#141413]"
                      : "bg-[#EFECE6] text-transparent",
                  )}
                >
                  ✓
                </span>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-[11px] leading-snug",
                  accountType === "DESIGNER"
                    ? "text-white/75"
                    : "text-[#6B6860]",
                )}
              >
                Create workspaces, sync folders, version designs &amp; invite
                clients.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAccountType("CLIENT")}
              className={cn(
                "flex flex-col justify-between rounded-2xl border p-3.5 text-left transition",
                accountType === "CLIENT"
                  ? "border-[#141413] bg-[#141413] text-white shadow-pill"
                  : "border-[#EBE7DF] bg-[#FAF8F4] text-[#141413] hover:bg-white",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  Client / Reviewer
                </span>
                <span
                  className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                    accountType === "CLIENT"
                      ? "bg-[#9FE830] text-[#141413]"
                      : "bg-[#EFECE6] text-transparent",
                  )}
                >
                  ✓
                </span>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-[11px] leading-snug",
                  accountType === "CLIENT"
                    ? "text-white/75"
                    : "text-[#6B6860]",
                )}
              >
                Request project access by slug, view deliverables, review
                versions &amp; approve work.
              </p>
            </button>
          </div>
        </div>
      )}

      {!isLogin ? (
        <>
          <Field label="Full Name">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={
                accountType === "CLIENT" ? "Sarah Jenkins" : "Evan Parker"
              }
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={
                accountType === "CLIENT"
                  ? "Company / Brand"
                  : "Studio / Agency"
              }
            >
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={
                  accountType === "CLIENT" ? "Acme Corp" : "Northstar Studio"
                }
              />
            </Field>
            <Field label="Role / Title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  accountType === "CLIENT"
                    ? "Brand Director"
                    : "Lead Product Designer"
                }
              />
            </Field>
          </div>
        </>
      ) : null}

      <Field label="Email Address">
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@studio.com"
        />
      </Field>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-[#6B6860]">
            Password
          </span>
          {isLogin ? (
            <button
              type="button"
              onClick={() => {
                setForgotMode(true);
                setResetStep("EMAIL");
                setError(null);
              }}
              className="text-xs font-medium text-[#6D28D9] underline hover:text-[#141413]"
            >
              Forgot password? (Reset with OTP)
            </button>
          ) : null}
        </div>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={isLogin ? 1 : 8}
        />
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button type="submit" disabled={busy} className="w-full py-2.5">
        {busy
          ? "Please wait…"
          : isLogin
            ? "Sign in to Workspace"
            : "Send 6-Digit Email OTP →"}
      </Button>

      <p className="text-center text-xs text-[#6B6860]">
        {isLogin ? (
          <>
            No account yet?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#141413] underline"
            >
              Create Designer or Client account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#141413] underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
