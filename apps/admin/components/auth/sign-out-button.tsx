"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { postJson } from "@/lib/api/browser";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await postJson("/api/auth/logout");
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-white/10 disabled:opacity-60"
    >
      <LogOut className="size-4" aria-hidden /> {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
