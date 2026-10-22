import { NextResponse, type NextRequest } from "next/server";
import { callAdminApi } from "@/lib/api/admin-api";
import { clientContext, csrfRejection, errorResponse } from "@/lib/auth/bff";
import { clearSessionCookies, setSessionCookies, setSetupCookie } from "@/lib/auth/cookies";
import { loginSchema } from "@/lib/auth/schemas";

type LoginResponse =
  | { twoFactorSetupRequired: true; setupToken: string }
  | { twoFactorSetupRequired: false; accessToken: string; refreshToken: string };

export async function POST(request: NextRequest) {
  const rejected = csrfRejection(request);
  if (rejected) return rejected;

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  const { email, password, code } = parsed.data;

  try {
    const result = await callAdminApi<LoginResponse>("/admin/auth/login", {
      body: { email, password, ...(code ? { code } : {}) },
      ...clientContext(request),
    });

    if (result.twoFactorSetupRequired) {
      const res = NextResponse.json({ data: { status: "2fa_setup_required" } });
      clearSessionCookies(res);
      setSetupCookie(res, result.setupToken);
      return res;
    }

    const res = NextResponse.json({ data: { status: "ok" } });
    setSessionCookies(res, result.accessToken, result.refreshToken);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
