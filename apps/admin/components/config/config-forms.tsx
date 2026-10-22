"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@rakhal/ui/ui/button";
import { ActionDialog } from "@/components/directory/action-dialog";
import { createFlagAction, saveSettingAction, toggleFlagAction } from "@/lib/actions/ops";
import { initialActionState } from "@/lib/actions/support-state";

const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  return (
    <ActionDialog
      key={`${flagKey}-${enabled}`}
      action={toggleFlagAction.bind(null, flagKey, !enabled)}
      triggerLabel={enabled ? "Turn off" : "Turn on"}
      title={enabled ? "Turn this flag off for everyone?" : "Turn this flag on for everyone?"}
      description={
        enabled
          ? "Features behind this flag stop for all farms (except none are allow-listed)."
          : "Features behind this flag start for every farm immediately."
      }
      confirmValue={flagKey}
      confirmNoun="flag key"
      submitLabel={enabled ? "Turn off" : "Turn on"}
      danger={enabled}
    />
  );
}

function Feedback({ ok, message }: { ok: boolean; message: string | null }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-md px-3 py-2 text-sm ${ok ? "bg-success-tint" : "bg-destructive-tint text-destructive"}`}
    >
      {message}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function CreateFlagForm() {
  const [state, action, pending] = useActionState(createFlagAction, initialActionState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state.ok]);

  return (
    <form ref={form} action={action} className="space-y-3">
      <Feedback ok={state.ok} message={state.message} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="flag-key" className="text-sm font-medium">
            Key
          </label>
          <input id="flag-key" name="key" placeholder="milk.new_entry" required className={field} />
          <FieldError message={state.errors?.key} />
        </div>
        <div className="space-y-1">
          <label htmlFor="flag-desc" className="text-sm font-medium">
            Description
          </label>
          <input id="flag-desc" name="description" maxLength={300} className={field} />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="flag-reason" className="text-sm font-medium">
          Reason (kept in the audit log)
        </label>
        <input id="flag-reason" name="reason" required minLength={10} className={field} />
        <FieldError message={state.errors?.reason} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create flag (off)"}
      </Button>
    </form>
  );
}

export function SaveSettingForm() {
  const [state, action, pending] = useActionState(saveSettingAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <Feedback ok={state.ok} message={state.message} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="set-key" className="text-sm font-medium">
            Key
          </label>
          <input id="set-key" name="key" placeholder="trial.days" required className={field} />
          <FieldError message={state.errors?.key} />
        </div>
        <div className="space-y-1">
          <label htmlFor="set-value" className="text-sm font-medium">
            Value (JSON)
          </label>
          <input id="set-value" name="value" placeholder='14  or  {"max": 50}' required className={field} />
          <FieldError message={state.errors?.value} />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="set-reason" className="text-sm font-medium">
          Reason (kept in the audit log)
        </label>
        <input id="set-reason" name="reason" required minLength={10} className={field} />
        <FieldError message={state.errors?.reason} />
      </div>
      <p className="text-xs text-muted-foreground">Not for credentials: keys that look like secrets are refused.</p>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save setting"}
      </Button>
    </form>
  );
}
