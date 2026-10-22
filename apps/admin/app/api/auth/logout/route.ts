import { NextResponse, type NextRequest } from "next/server";
import { callAdminApi } from "@/lib/api/admin-api";
import { clientContext, csrfRejection } from "@/lib/auth/bff";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { clearSessionCookies } from "@/lib/auth/cookies";

/** Revokes the server-side session (best effort) and always clears the cookies. */
export async function POST(request: NextRequest) {
  const rejected = csrfRejection(request);
  if (rejected) return rejected;

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    await callAdminApi("/admin/auth/logout", { method: "POST", token, ...clientContext(request) }).catch(
      () => undefined,
    );
  }
  const res = NextResponse.json({ data: { status: "signed_out" } });
  clearSessionCookies(res);
  return res;
}
