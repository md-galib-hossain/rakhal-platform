"use client";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/auth/use-session";

export function LogoutButton() {
  const logout = useLogout();
  return (
    <Button variant="secondary" size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}>
      {logout.isPending ? "Logging out…" : "Log Out"}
    </Button>
  );
}
