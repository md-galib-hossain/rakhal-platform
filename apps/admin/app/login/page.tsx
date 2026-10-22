import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";

// TODO(P2-07): wire to the admin BFF login + TOTP flow. Static shell only in Phase 1.
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Rakhal Admin sign in</h1>
      <Input type="email" placeholder="Email" autoComplete="username" aria-label="Email" />
      <Input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        aria-label="Password"
      />
      <Button disabled>Sign in (Phase 2)</Button>
    </main>
  );
}
