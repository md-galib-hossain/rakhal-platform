import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { acceptTeamInvite } from "@/lib/auth/session";

const bodySchema = z.object({ token: z.string().min(1) });

/** POST body: {token}. See lib/auth/session.ts#acceptTeamInvite — bespoke cookie escalation
 * (current session's token → the invite's farm-scoped one), same shape as create-farm's route. */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid request body.", code: "VALIDATION_ERROR", requestId: "", timestamp: new Date().toISOString() },
      { status: 400 },
    );
  }

  try {
    const result = await acceptTeamInvite(parsed.data.token);
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
