"use client";

import { useEffect, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full ${width} max-h-[90vh] overflow-y-auto rounded-[28px] border border-[#EBE7DF] bg-white p-6 shadow-float`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-5 flex items-center justify-between border-b border-[#F2EFE8] pb-3.5">
          <h2 className="font-serif text-2xl font-normal text-[#141413]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F2ED] text-[#6B6860] transition hover:bg-[#EAE5DC] hover:text-[#141413]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
        {footer ? (
          <div className="mt-6 flex justify-end gap-2.5 border-t border-[#F2EFE8] pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
