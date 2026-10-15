import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PixelHubLogo({
  size = "md",
  subtitle,
}: {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
}) {
  const iconBox =
    size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const textClass =
    size === "lg"
      ? "text-2xl"
      : size === "sm"
        ? "text-base"
        : "text-[19px]";

  return (
    <div className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center text-[#141413]",
          iconBox,
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
          {/* 6-petal geometric flower / node mark inspired by RevenueX */}
          <circle cx="16" cy="6.5" r="4.2" fill="currentColor" />
          <circle cx="16" cy="25.5" r="4.2" fill="currentColor" />
          <circle cx="7.8" cy="11.2" r="4.2" fill="currentColor" />
          <circle cx="24.2" cy="20.8" r="4.2" fill="currentColor" />
          <circle cx="7.8" cy="20.8" r="4.2" fill="currentColor" />
          <circle cx="24.2" cy="11.2" r="4.2" fill="currentColor" />
          <circle cx="16" cy="16" r="3.4" fill="#F4F1EA" />
        </svg>
      </span>
      <div className="leading-none">
        <span
          className={cn(
            "font-serif font-normal tracking-tight text-[#141413]",
            textClass,
          )}
        >
          PixelHub
        </span>
        {subtitle ? (
          <span className="block text-[11px] text-[#6B6860]">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-[#EBE7DF] bg-white p-6 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  hint,
  icon,
}: {
  children: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F4F2ED] text-[#141413]">
          {icon ?? (
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path
                d="M2.5 12.5V3.5M2.5 12.5H13.5M5.5 9.5L8 7L10.2 9L13 5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <h3 className="font-serif text-[21px] font-normal leading-tight tracking-[-0.01em] text-[#141413]">
          {children}
        </h3>
      </div>
      {hint ? <div className="flex items-center gap-2">{hint}</div> : null}
    </div>
  );
}

export type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "lime"
  | "violet"
  | "dark";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-[#F3F1EC] text-[#57544E]",
  success: "bg-[#E8F8EE] text-[#15803D]",
  warning: "bg-[#FEF6E0] text-[#B45309]",
  danger: "bg-[#FEECEB] text-[#B91C1C]",
  info: "bg-[#EBF3FE] text-[#1D4ED8]",
  lime: "bg-[#9FE830] text-[#141413] font-semibold",
  violet: "bg-[#F3EEFF] text-[#6D28D9]",
  dark: "bg-[#141413] text-white",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "violet",
}: {
  value: number;
  tone?: "rose" | "emerald" | "violet" | "lime" | "dark";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const barTone =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "lime"
        ? "bg-[#9FE830]"
        : tone === "dark"
          ? "bg-[#141413]"
          : "bg-[#7C3AED]";

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFECE6]">
      <div
        className={cn("h-full rounded-full transition-all duration-500", barTone)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function SegmentedProgress({
  value,
  segments = 28,
}: {
  value: number;
  segments?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const activeCount = Math.round((clamped / 100) * segments);

  return (
    <div
      className="flex items-center gap-[3px]"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: segments }).map((_, index) => {
        const active = index < activeCount;
        return (
          <span
            key={index}
            className={cn(
              "h-5 flex-1 rounded-[2px] transition-colors duration-300",
              active
                ? "bg-gradient-to-b from-[#9333EA] to-[#6D28D9]"
                : "bg-[#ECE9E2]",
            )}
          />
        );
      })}
    </div>
  );
}

export function Donut({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-[#EFECE6]"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-[#7C3AED]"
        />
      </svg>
      <div>
        <div className="text-3xl font-bold tracking-tight text-[#6D28D9]">
          {clamped}%
        </div>
        {label ? <div className="text-xs text-[#6B6860]">{label}</div> : null}
      </div>
    </div>
  );
}
