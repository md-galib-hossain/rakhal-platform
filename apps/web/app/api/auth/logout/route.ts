import { NextResponse } from "next/server";
import { logoutSession } from "@/lib/auth/session";

/** Always succeeds locally even if the backend call fails (docs/ARCHITECTURE.md §5.4). */
export async function POST() {
  await logoutSession();
  return NextResponse.json({ success: true, data: null });
}
