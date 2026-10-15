"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { Button, ErrorText, Field, Input, Select } from "@/components/form";
import { Modal } from "@/components/modal";

export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  accountType: "DESIGNER" | "CLIENT";
  company?: string | null;
  title?: string | null;
}

export function AccountSettingsForm({
  user,
  onSaved,
}: {
  user: UserProfileData;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"PROFILE" | "SECURITY" | "PROVIDERS">(
    "PROFILE",
  );

  // Profile fields
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [company, setCompany] = useState(user.company ?? "");
  const [title, setTitle] = useState(user.title ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Password fields + Email OTP verification
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [otpPreviewUrl, setOtpPreviewUrl] = useState<string | null>(null);

  // Groq LLM & Email SMTP Provider settings
  const [groqApiKey, setGroqApiKey] = useState("");
  const [groqModel, setGroqModel] = useState("qwen/qwen3.8-27b");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");

  useEffect(() => {
    apiFetch<{
      ai: { configured: boolean; model: string; maskedKey: string | null };
    }>("/ai/config")
      .then((res) => {
        setAiConfigured(res.ai.configured);
        setGroqModel(res.ai.model || "qwen/qwen3.8-27b");
        setMaskedKey(res.ai.maskedKey);
      })
      .catch(() => undefined);
  }, []);

  async function saveProviderConfig() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await apiFetch<{
        ai: { configured: boolean; model: string; maskedKey: string | null };
      }>("/ai/config", {
        method: "POST",
        body: JSON.stringify({
          ...(groqApiKey.trim() ? { groqApiKey: groqApiKey.trim() } : {}),
          groqModel,
          ...(smtpHost.trim() ? { smtpHost: smtpHost.trim() } : {}),
          ...(smtpPort.trim() ? { smtpPort: Number(smtpPort) || 587 } : {}),
          ...(smtpUser.trim() ? { smtpUser: smtpUser.trim() } : {}),
          ...(smtpPass.trim() ? { smtpPass: smtpPass.trim() } : {}),
          ...(resendApiKey.trim() ? { resendApiKey: resendApiKey.trim() } : {}),
        }),
      });
      setAiConfigured(res.ai.configured);
      setMaskedKey(res.ai.maskedKey);
      setGroqApiKey("");
      setNote(
        "Groq LLM & Email OTP provider settings saved to runtime and .env.local.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save provider config",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordOtp() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await apiFetch<{
        sent: boolean;
        email: string;
        previewUrl?: string | null;
        devOtp?: string;
      }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          purpose: "RESET_PASSWORD",
        }),
      });
      setOtpSent(true);
      setDevOtpHint(res.devOtp ?? null);
      setOtpPreviewUrl(res.previewUrl ?? null);
      if (res.devOtp) setOtp(res.devOtp);
      setNote(`6-digit OTP verification code generated for ${res.email}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send verification code",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!name.trim() || !email.trim()) {
      setError("Full name and email address are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || null,
          title: title.trim() || null,
        }),
      });
      setNote("Account profile settings saved.");
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!newPassword) {
      setError("Enter a new password.");
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
    if (otp.trim().length !== 6) {
      setError("Enter the 6-digit Email OTP code to verify this password change.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await apiFetch("/auth/password", {
        method: "POST",
        body: JSON.stringify({
          ...(currentPassword ? { currentPassword } : {}),
          otp: otp.trim(),
          newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setOtpSent(false);
      setDevOtpHint(null);
      setNote("Password verified with OTP and updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Identity Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl bg-[#FAF8F4] p-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#141413] text-sm font-bold text-white">
            {initials(name || user.email)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-[#141413]">{name}</p>
              <Badge tone={user.accountType === "CLIENT" ? "info" : "lime"}>
                {user.accountType === "CLIENT"
                  ? "Client Account (Locked)"
                  : "Designer Account (Locked)"}
              </Badge>
            </div>
            <p className="truncate text-xs text-[#6B6860]">{email}</p>
            <p className="mt-0.5 text-[11px] text-[#9A968C]">
              Account type is permanently bound at signup and cannot be switched.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex gap-1.5 border-b border-[#F2EFE8] pb-3">
        <button
          type="button"
          onClick={() => {
            setTab("PROFILE");
            setError(null);
            setNote(null);
          }}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-medium transition",
            tab === "PROFILE"
              ? "bg-[#141413] text-white shadow-pill"
              : "bg-[#FAF8F4] text-[#6B6860] hover:text-[#141413]",
          )}
        >
          Profile & Identity
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("SECURITY");
            setError(null);
            setNote(null);
          }}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-medium transition",
            tab === "SECURITY"
              ? "bg-[#141413] text-white shadow-pill"
              : "bg-[#FAF8F4] text-[#6B6860] hover:text-[#141413]",
          )}
        >
          Password &amp; Security (OTP)
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("PROVIDERS");
            setError(null);
            setNote(null);
          }}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-medium transition",
            tab === "PROVIDERS"
              ? "bg-[#141413] text-white shadow-pill"
              : "bg-[#FAF8F4] text-[#6B6860] hover:text-[#141413]",
          )}
        >
          ✦ Groq AI &amp; Email OTP Setup
        </button>
      </div>

      {tab === "PROFILE" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </Field>
            <Field label="Email Address">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={
                user.accountType === "CLIENT"
                  ? "Company / Brand"
                  : "Studio / Agency"
              }
            >
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={
                  user.accountType === "CLIENT"
                    ? "Acme Corp"
                    : "Northstar Studio"
                }
              />
            </Field>
            <Field label="Job Title / Role">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  user.accountType === "CLIENT"
                    ? "VP of Brand & Marketing"
                    : "Lead Product Designer"
                }
              />
            </Field>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => void saveProfile()} disabled={busy}>
              {busy ? "Saving…" : "Save Profile Changes"}
            </Button>
          </div>
        </div>
      ) : tab === "SECURITY" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-3.5 text-xs">
            <div>
              <p className="font-semibold text-[#141413]">
                Email OTP Verification Required
              </p>
              <p className="text-[#6B6860]">
                Send a 6-digit verification code to{" "}
                <strong>{user.email}</strong> to reset or change your password.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void requestPasswordOtp()}
            >
              {otpSent ? "Resend OTP" : "Send 6-Digit OTP"}
            </Button>
          </div>

          {devOtpHint ? (
            <div className="space-y-1 rounded-2xl border border-[#9FE830] bg-[#9FE830]/20 px-3.5 py-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span>
                  OTP Code for <strong>{user.email}</strong>:{" "}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="6-Digit Email OTP Code">
              <Input
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                maxLength={6}
                className="font-mono tracking-[0.3em]"
              />
            </Field>
            <Field label="Current Password (Optional with OTP)">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New Password" hint="Minimum 8 characters">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />
            </Field>
            <Field label="Confirm New Password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </Field>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => void savePassword()}
              disabled={busy || otp.length !== 6}
            >
              {busy ? "Verifying & Updating…" : "Verify OTP & Update Password"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#141413]">
                Groq LLM Provider (Design Reviewer, Feedbacks &amp; Help Chatbot)
              </span>
              <Badge tone={aiConfigured ? "lime" : "warning"}>
                {aiConfigured
                  ? `Connected (${maskedKey ?? "Groq"})`
                  : "Using Local Fallback"}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Groq API Key (GROQ_API_KEY)"
                hint="Starts with gsk_... (saved to .env.local)"
              >
                <Input
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder={maskedKey ?? "gsk_..."}
                />
              </Field>
              <Field label="Groq Model">
                <Select
                  value={groqModel}
                  onChange={(e) => setGroqModel(e.target.value)}
                >
                  <option value="qwen/qwen3.8-27b">
                    qwen/qwen3.8-27b (Default)
                  </option>
                  <option value="qwen/qwen3-32b">qwen/qwen3-32b</option>
                  <option value="llama-3.3-70b-versatile">
                    llama-3.3-70b-versatile
                  </option>
                  <option value="llama-3.1-8b-instant">
                    llama-3.1-8b-instant
                  </option>
                </Select>
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4] p-4 space-y-3">
            <p className="font-semibold text-[#141413]">
              External Email OTP Delivery (Optional — Nodemailer SMTP or Resend)
            </p>
            <p className="text-[#6B6860]">
              By default, OTPs are stored in PostgreSQL, displayed in the UI,
              and sent to a Nodemailer Ethereal webmail inbox. Enter your SMTP
              or Resend credentials below to deliver OTP emails to external
              inboxes.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Resend API Key (Optional)">
                <Input
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="re_..."
                />
              </Field>
              <Field label="Or SMTP Host (e.g. smtp.gmail.com)">
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </Field>
              <Field label="SMTP User / Email">
                <Input
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="you@gmail.com"
                />
              </Field>
              <Field label="SMTP App Password">
                <Input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="App password"
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void saveProviderConfig()} disabled={busy}>
              {busy ? "Saving…" : "Save Groq & Email Settings"}
            </Button>
          </div>
        </div>
      )}

      {error ? <ErrorText>{error}</ErrorText> : null}
      {note ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function UserProfileModal({
  user,
  open,
  onClose,
}: {
  user: UserProfileData;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Account Settings"
      width="max-w-xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Link
            href="/app/settings"
            onClick={onClose}
            className="text-xs font-medium text-[#6B6860] underline hover:text-[#141413]"
          >
            Open Full Account Settings Page ↗
          </Link>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <AccountSettingsForm user={user} />
    </Modal>
  );
}
