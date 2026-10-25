"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AdminApiError, callAdminApi } from "@/lib/api/admin-api";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { initialActionState, type ActionState } from "./support-state";

export async function sendDirectUserMessage(
  userId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: "Your session has expired. Sign in again." };

  const title = (formData.get("title") ?? "").toString().trim();
  const message = (formData.get("message") ?? "").toString().trim();
  const link = (formData.get("link") ?? "").toString().trim();
  const channel = (formData.get("channel") ?? "all").toString().trim();

  if (title.length < 5) {
    return { ok: false, message: "Title must be at least 5 characters.", errors: { title: "Min 5 characters" } };
  }
  if (message.length < 10) {
    return { ok: false, message: "Message must be at least 10 characters.", errors: { message: "Min 10 characters" } };
  }

  try {
    await callAdminApi(`/admin/communications/users/${encodeURIComponent(userId)}/message`, {
      method: "POST",
      token,
      body: { title, message, link: link || undefined, channel },
    });
  } catch (err) {
    if (err instanceof AdminApiError) {
      return { ok: false, message: err.body?.message ?? "Failed to send message." };
    }
    return { ok: false, message: "Something went wrong while sending the notification." };
  }

  revalidatePath(`/users/${userId}`);
  revalidatePath("/audit");
  return { ok: true, message: "Message dispatched successfully across user's channels (Telegram / Push)." };
}

export async function sendBroadcastMessage(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: "Your session has expired. Sign in again." };

  const title = (formData.get("title") ?? "").toString().trim();
  const message = (formData.get("message") ?? "").toString().trim();
  const link = (formData.get("link") ?? "").toString().trim();
  const targetAudience = (formData.get("targetAudience") ?? "all").toString().trim();

  if (title.length < 5) {
    return { ok: false, message: "Title must be at least 5 characters.", errors: { title: "Min 5 characters" } };
  }
  if (message.length < 10) {
    return { ok: false, message: "Message must be at least 10 characters.", errors: { message: "Min 10 characters" } };
  }

  try {
    const res = await callAdminApi<{
      targetedCount?: number;
      deliveredCount?: number;
      data?: { targetedCount: number; deliveredCount: number };
    }>("/admin/communications/broadcast", {
      method: "POST",
      token,
      body: { title, message, link: link || undefined, targetAudience },
    });

    const targeted = res?.targetedCount ?? res?.data?.targetedCount ?? 0;
    const delivered = res?.deliveredCount ?? res?.data?.deliveredCount ?? 0;

    revalidatePath("/communications");
    revalidatePath("/audit");
    return {
      ok: true,
      message: `Broadcast delivered successfully to ${delivered} of ${targeted} recipients.`,
    };
  } catch (err) {
    if (err instanceof AdminApiError) {
      return { ok: false, message: err.body?.message ?? "Failed to send broadcast." };
    }
    const errMsg = err instanceof Error ? err.message : "Failed to broadcast announcement.";
    return { ok: false, message: errMsg };
  }
}
