import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "violet" | "lime";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[#141413] text-white shadow-pill hover:bg-[#2A2927] disabled:bg-[#141413]/40",
  secondary:
    "border border-[#E6E1D6] bg-white text-[#141413] shadow-pill hover:bg-[#F7F5F0]",
  ghost: "text-[#6B6860] hover:bg-[#F3F1EC] hover:text-[#141413]",
  danger:
    "border border-rose-200 bg-[#FEECEB]/60 text-rose-700 hover:bg-[#FEECEB]",
  violet: "bg-[#7C3AED] text-white shadow-pill hover:bg-[#6D28D9]",
  lime: "bg-[#9FE830] text-[#141413] font-semibold shadow-pill hover:bg-[#92DC25]",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#6B6860]"
    >
      {children}
    </label>
  );
}

const FIELD_CLASSES =
  "w-full rounded-xl border border-[#E6E1D6] bg-[#FCFBF9] px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#9A968C] outline-none transition focus:border-[#7C3AED] focus:bg-white focus:ring-2 focus:ring-[#7C3AED]/15 disabled:bg-[#F3F1EC]";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-[#6B6860]">{hint}</p> : null}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl border border-rose-200 bg-[#FEECEB]/60 px-3 py-2 text-xs font-medium text-rose-700">
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#DFD9CC] bg-[#FAF8F4] p-8 text-center">
      <p className="font-serif text-xl text-[#141413]">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#6B6860]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
