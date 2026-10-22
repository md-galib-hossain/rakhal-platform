"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@rakhal/ui/ui/button";
import { runSupportAction } from "@/lib/actions/support";
import { initialActionState, type ActionState } from "@/lib/actions/support-state";
import type { SupportActionKind } from "@/lib/actions/support-request";

/**
 * Confirmation dialog for a high-impact support action. The admin must give a written reason and type the
 * target's name; the submit button stays disabled until it matches. That check is a convenience - the backend
 * verifies the same text against the real record, so a stale or tampered page cannot act on the wrong target.
 */
export function ActionDialog({
  kind,
  targetId,
  action,
  triggerLabel,
  title,
  description,
  confirmValue,
  confirmNoun,
  submitLabel,
  danger = false,
  children,
}: {
  /** Support actions (farm/user): the dialog binds `runSupportAction` itself. */
  kind?: SupportActionKind;
  targetId?: string;
  /** Any other server action, already bound to its target (e.g. retry a job, toggle a flag). */
  action?: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  triggerLabel: string;
  title: string;
  description: string;
  /** Exact text the admin must type (farm name / user email). */
  confirmValue: string;
  confirmNoun: string;
  submitLabel: string;
  danger?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const bound = action ?? runSupportAction.bind(null, kind as SupportActionKind, targetId as string);
  const [state, formAction, pending] = useActionState(bound, initialActionState);
  const ids = { reason: useId(), confirm: useId() };

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  function open() {
    setTyped("");
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }

  const matches = typed.trim() === confirmValue;

  return (
    <>
      <Button type="button" variant={danger ? "destructive" : "secondary"} size="sm" onClick={open}>
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${ids.reason}-title`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/50"
        onClose={() => setTyped("")}
      >
        <form action={formAction} className="space-y-4 p-5">
          <div className="space-y-1">
            <h2 id={`${ids.reason}-title`} className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {state.ok ? (
            <>
              <p role="status" className="rounded-md bg-success-tint px-3 py-2 text-sm">
                {state.message}
              </p>
              <div className="flex justify-end">
                <Button type="button" onClick={close}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <>
              {state.message ? (
                <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
                  {state.message}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor={ids.reason} className="text-sm font-medium">
                  Reason (kept in the audit log)
                </label>
                <textarea
                  id={ids.reason}
                  name="reason"
                  required
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  placeholder="e.g. Ticket 4821: owner reported shared credentials"
                  aria-invalid={!!state.errors?.reason}
                />
                {state.errors?.reason ? <p className="text-xs text-destructive">{state.errors.reason}</p> : null}
              </div>

              {children}

              <div className="space-y-1.5">
                <label htmlFor={ids.confirm} className="text-sm font-medium">
                  Type <strong className="break-all">{confirmValue}</strong> to confirm the {confirmNoun}
                </label>
                <input
                  id={ids.confirm}
                  name="confirm"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                  aria-invalid={!!state.errors?.confirm}
                />
                {state.errors?.confirm ? <p className="text-xs text-destructive">{state.errors.confirm}</p> : null}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={close} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" variant={danger ? "destructive" : "primary"} disabled={!matches || pending}>
                  {pending ? "Working..." : submitLabel}
                </Button>
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
