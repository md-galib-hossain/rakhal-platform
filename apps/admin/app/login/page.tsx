import { redirect } from "next/navigation";
import { AuthCard, Notice } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/next-path";
import { getSession } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; "2fa"?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSession()) redirect(next);

  return (
    <AuthCard title="Sign in" description="Internal Rakhal team access. Every action is audited.">
      <div className="space-y-4">
        {params["2fa"] === "enabled" ? (
          <Notice>Two-factor authentication is on. Sign in again with a code from your authenticator.</Notice>
        ) : null}
        <LoginForm next={next} />
      </div>
    </AuthCard>
  );
}
