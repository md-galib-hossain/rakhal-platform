import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { selectFarm } from "@/lib/auth/session";

const bodySchema = z.object({ farmId: z.string().min(1) });

/** POST body: {farmId}. See lib/auth/session.ts#selectFarm — escalates the already-persisted
 * session (set by /api/auth/login's multi-farm branch) via /auth/refresh, no password resend. */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid request body.", code: "VALIDATION_ERROR", requestId: "", timestamp: new Date().toISOString() },
      { status: 400 },
    );
  }

  try {
    const result = await selectFarm(parsed.data.farmId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { success: false, message: err.message, code: err.code, requestId: err.requestId ?? "", timestamp: new Date().toISOString() },
        { status: err.status },
      );
    }
    if (err instanceof NetworkError) {
      return NextResponse.json(
        { success: false, message: "Could not reach the backend.", code: "NETWORK_ERROR", requestId: "", timestamp: new Date().toISOString() },
        { status: 503 },
      );
    }
    throw err;
  }
}
