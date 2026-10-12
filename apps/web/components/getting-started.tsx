import Link from "next/link";
import { cn } from "@/lib/utils";

export interface GettingStartedStep {
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export function GettingStarted({ steps }: { steps: GettingStartedStep[] }) {
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">
          Get started — set up your project in {steps.length} steps
        </h2>
        <span className="text-xs text-neutral-500">
          {doneCount}/{steps.length} done
        </span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-white p-3 transition hover:border-rose-300",
                step.done
                  ? "border-neutral-200 opacity-70"
                  : "border-neutral-200",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  step.done
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700",
                )}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    step.done
                      ? "text-neutral-400 line-through"
                      : "text-neutral-800",
                  )}
                >
                  {step.label}
                </span>
                <span className="block text-xs text-neutral-500">
                  {step.hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
