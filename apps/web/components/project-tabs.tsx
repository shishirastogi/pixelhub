"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Pulse", segment: "" },
  { label: "Brief", segment: "brief" },
  { label: "Versions", segment: "versions" },
  { label: "Design Sheet", segment: "design-sheet" },
  { label: "Brand Kit", segment: "brand-kit" },
  { label: "Files", segment: "files" },
  { label: "Tasks", segment: "tasks" },
  { label: "Settings", segment: "settings" },
] as const;

export function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/p/${slug}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base;

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
              active
                ? "border-rose-600 font-medium text-rose-700"
                : "border-transparent text-neutral-600 hover:text-neutral-900",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
