import { NextResponse, type NextRequest } from "next/server";
import { callAdminApi } from "@/lib/api/admin-api";
import { clientContext, csrfRejection, errorResponse } from "@/lib/auth/bff";
import { SETUP_COOKIE } from "@/lib/auth/cookie-names";

/** Issues a fresh TOTP secret for the admin holding a valid setup cookie. The secret is shown once to the user. */
export async function POST(request: NextRequest) {
  const rejected = csrfRejection(request);
  if (rejected) return rejected;
  const token = request.cookies.get(SETUP_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Setup session expired. Sign in again." }, { status: 401 });

  try {
    const data = await callAdminApi<{ secret: string; otpauthUrl: string }>("/admin/auth/2fa/setup", {
      method: "POST",
      token,
      ...clientContext(request),
    });
    return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
