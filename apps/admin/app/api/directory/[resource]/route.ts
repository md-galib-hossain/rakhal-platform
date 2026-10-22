import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AdminApiError } from "@/lib/api/admin-api";
import { listAudit, listFarms, listUsers } from "@/lib/api/directory";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";

/**
 * Read-only BFF for the infinite lists: the browser never holds the access token, so "load more" goes
 * through here, and the backend still enforces each list's permission on the bearer token.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Sign in again." }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const search = sp.get("search") || undefined;
  const status = sp.get("status") || undefined;
  const action = sp.get("action") || undefined;
  const cursor = sp.get("cursor") || undefined;

  try {
    switch (resource) {
      case "farms":
        return NextResponse.json(await listFarms({ search, status, cursor }));
      case "users":
        return NextResponse.json(await listUsers({ search, cursor }));
      case "audit":
        return NextResponse.json(await listAudit({ action, cursor }));
      default:
        return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
  } catch (err) {
    if (isRedirectError(err)) return NextResponse.json({ message: "Sign in again." }, { status: 401 });
    if (err instanceof AdminApiError && err.status === 403) {
      return NextResponse.json({ message: "You do not have access to this list." }, { status: 403 });
    }
    return NextResponse.json({ message: "Could not load more. Try again." }, { status: 502 });
  }
}
