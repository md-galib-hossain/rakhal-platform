import { NextResponse, type NextRequest } from "next/server";
import { AdminApiError, callAdminApi } from "@/lib/api/admin-api";
import { clientContext, csrfRejection, errorResponse } from "@/lib/auth/bff";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { changePasswordSchema } from "@/lib/auth/schemas";

/** Self-service password change; the backend verifies the current password and applies the policy. */
export async function POST(request: NextRequest) {
  const rejected = csrfRejection(request);
  if (rejected) return rejected;
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Session expired. Sign in again." }, { status: 401 });

  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid request" }, { status: 400 });

  try {
    await callAdminApi("/admin/auth/change-password", {
      token,
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword },
      ...clientContext(request),
    });
    return NextResponse.json({ data: { status: "changed" } });
  } catch (err) {
    // The backend answers 401 for a wrong current password; to the user that is not "signed out".
    if (err instanceof AdminApiError && err.status === 401) {
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
    }
    return errorResponse(err);
  }
}
