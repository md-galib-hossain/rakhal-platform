import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { createFirstFarm } from "@/lib/auth/session";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  agreeToTerms: z.literal(true),
});

/** POST body: {name, description?}. See lib/auth/session.ts#createFirstFarm — bespoke cookie
 * escalation logic (bootstrap → real farm-scoped token), same shape as /api/auth/login. */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid request body.", code: "VALIDATION_ERROR", requestId: "", timestamp: new Date().toISOString() },
      { status: 400 },
    );
  }

  try {
    const result = await createFirstFarm(parsed.data.name, parsed.data.description);
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
