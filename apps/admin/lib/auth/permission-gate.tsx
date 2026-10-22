import { ForbiddenState } from "@/components/shared/forbidden-state";
import { getSession } from "./session";
import { judgeGate } from "../permissions";

/**
 * Server-side page gate: renders its children only when the signed-in admin holds `perm`.
 * Hiding a nav link is not security - the matching API route enforces the same permission.
 */
export async function PermissionGate({
  perm,
  children,
}: {
  perm: string;
  children: React.ReactNode;
}) {
  const session = await getSession();
  const gate = judgeGate(session?.permissions ?? [], perm);
  return gate.allowed ? <>{children}</> : <ForbiddenState permission={perm} />;
}
