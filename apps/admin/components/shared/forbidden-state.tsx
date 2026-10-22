import { ShieldAlert } from "lucide-react";

/** Shown when the signed-in admin lacks the permission for a page. The API enforces it too; this is the friendly face. */
export function ForbiddenState({ permission }: { permission?: string }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <ShieldAlert className="size-10 text-warning" aria-hidden />
      <h1 className="text-xl font-semibold text-foreground">You do not have access to this page</h1>
      <p className="text-sm text-muted-foreground">
        Your role is not allowed to view this area. Ask a super admin if you think this is a mistake.
      </p>
      {permission ? <code className="rounded bg-muted px-2 py-1 text-xs">{permission}</code> : null}
    </div>
  );
}
