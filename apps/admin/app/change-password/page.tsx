import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getSession } from "@/lib/auth/session";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AuthCard
      title="Change your password"
      description={
        session.mustChangePassword
          ? "You are using a temporary password. Choose a new one to continue."
          : "Choose a new password. Your other sessions will be signed out."
      }
    >
      <ChangePasswordForm />
    </AuthCard>
  );
}
