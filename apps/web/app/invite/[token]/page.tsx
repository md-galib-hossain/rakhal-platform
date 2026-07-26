import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { InviteAcceptView } from "@/features/invite/components/invite-accept-view";
import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import type { ApiEnvelope } from "@/types/api";
import type { InvitePreview } from "@/features/invite/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: `${t("metaTitle")} — Rakhal` };
}

/** Public route — no auth guard. Unlike every other backend call in this app, the preview fetch
 * goes straight at the backend (no cookies, no BFF proxy needed) since `GET
 * /onboarding/invites/:token` is deliberately unauthenticated so this page can render before the
 * invitee has an account (mirrors the pattern in `app/(onboarding)/onboarding/layout.tsx`). */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();

  let preview: InvitePreview | null = null;
  let notFound = false;
  try {
    const res = await fetch(`${serverEnv.API_BASE_URL}/onboarding/invites/${token}`, { cache: "no-store" });
    const envelope = (await res.json()) as ApiEnvelope<InvitePreview>;
    if (envelope.success) preview = envelope.data;
    else notFound = true;
  } catch {
    notFound = true;
  }

  return (
    <AuthShell>
      <InviteAcceptView
        token={token}
        preview={preview}
        notFound={notFound}
        hasSession={Boolean(session)}
        sessionEmail={session?.user.email ?? null}
      />
    </AuthShell>
  );
}
