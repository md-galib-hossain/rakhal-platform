import { NextResponse, type NextRequest } from "next/server";
import { callAdminApi } from "@/lib/api/admin-api";
import { clientContext, csrfRejection, errorResponse } from "@/lib/auth/bff";
import { SETUP_COOKIE } from "@/lib/auth/cookie-names";
import { clearSessionCookies } from "@/lib/auth/cookies";
import { codeSchema } from "@/lib/auth/schemas";

/** Confirms the pending secret with a live code. The admin must then sign in normally (with a code). */
export async function POST(request: NextRequest) {
  const rejected = csrfRejection(request);
  if (rejected) return rejected;
  const token = request.cookies.get(SETUP_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Setup session expired. Sign in again." }, { status: 401 });

  const parsed = codeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Enter the 6-digit code" }, { status: 400 });

  try {
    await callAdminApi("/admin/auth/2fa/enable", { token, body: parsed.data, ...clientContext(request) });
    const res = NextResponse.json({ data: { status: "enabled" } });
    clearSessionCookies(res);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
