import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { serverFetch } from "@/lib/api/server-fetch";

/**
 * Backs the client-side `useSession()` hook — httpOnly cookies aren't readable from JS directly.
 * Permissions come from a real, server-side `GET /auth/me` call (RAKHAL-260 — the backend now
 * exposes the caller's `resource.action` strings there, and never leaks `passwordHash`,
 * RAKHAL-259). Best-effort: if that call fails for any reason, permissions degrade to `[]`
 * rather than breaking session hydration entirely.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: true, data: null });
  }

  let permissions: string[] = [];
  try {
    const me = await serverFetch<{ permissions: string[] }>("/auth/me");
    permissions = me.permissions;
  } catch {
    // best-effort — an empty grant set just means <Can/> renders fallbacks
  }

  return NextResponse.json({
    success: true,
    data: { user: session.user, farmId: session.farmId, permissions },
  });
}
