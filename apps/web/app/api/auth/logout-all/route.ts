import { NextResponse } from "next/server";
import { logoutAllSessions } from "@/lib/auth/session";

/** Always succeeds locally even if the backend call fails (docs/ARCHITECTURE.md §5.4, mirrors /api/auth/logout). */
export async function POST() {
  const result = await logoutAllSessions();
  return NextResponse.json({ success: true, data: result });
}
