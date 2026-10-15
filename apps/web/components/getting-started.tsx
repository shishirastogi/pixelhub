import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge, SegmentedProgress } from "@/components/ui";

export interface GettingStartedStep {
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export function GettingStarted({ steps }: { steps: GettingStartedStep[] }) {
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="rounded-[24px] border border-[#EBE7DF] bg-white p-5 shadow-card">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F4F2ED] text-xs font-semibold text-[#141413]">
            ✦
          </span>
          <h2 className="font-serif text-xl text-[#141413]">
            Workspace Setup Checklist
          </h2>
          <Badge tone="lime">
            {doneCount}/{steps.length} complete
          </Badge>
        </div>
        <div className="w-36">
          <SegmentedProgress value={pct} segments={15} />
        </div>
      </div>

      <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn(
                "flex h-full flex-col justify-between rounded-2xl border p-3 transition",
                step.done
                  ? "border-[#EBE7DF] bg-[#FAF8F4] opacity-75"
                  : "border-[#EBE7DF] bg-white hover:border-[#141413]/30 hover:bg-[#FAF8F4]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    step.done
                      ? "bg-[#9FE830] text-[#141413]"
                      : "bg-[#141413] text-white",
                  )}
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <span className="text-[11px] text-[#9A968C]">→</span>
              </div>
              <div className="mt-2.5">
                <span
                  className={cn(
                    "block text-xs font-semibold",
                    step.done
                      ? "text-[#9A968C] line-through"
                      : "text-[#141413]",
                  )}
                >
                  {step.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[#6B6860]">
                  {step.hint}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
