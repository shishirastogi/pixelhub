"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-full border border-[#EBE7DF] bg-white px-3.5 py-2 text-xs font-medium text-[#57544E] shadow-pill transition hover:bg-[#F3F1EC] hover:text-[#141413]"
    >
      Sign out
    </button>
  );
}
