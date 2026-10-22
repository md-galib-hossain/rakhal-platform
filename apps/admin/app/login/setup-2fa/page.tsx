import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { Setup2faForm } from "@/components/auth/setup-2fa-form";
import { SETUP_COOKIE } from "@/lib/auth/cookie-names";

export default async function Setup2faPage() {
  // Only reachable right after a first sign-in that issued the short-lived setup cookie.
  if (!(await cookies()).get(SETUP_COOKIE)?.value) redirect("/login");

  return (
    <AuthCard
      title="Turn on two-factor authentication"
      description="Admin accounts require an authenticator app. You will sign in again with a code afterwards."
    >
      <Setup2faForm />
    </AuthCard>
  );
}
