"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@rakhal/ui/ui/button";
import { sendDirectUserMessage } from "@/lib/actions/communication";
import { initialActionState } from "@/lib/actions/support-state";

export function SendMessageDialog({
  userId,
  userName,
  hasTelegram,
  hasPush,
}: {
  userId: string;
  userName: string;
  hasTelegram?: boolean;
  hasPush?: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boundAction = sendDirectUserMessage.bind(null, userId);
  const [state, formAction, pending] = useActionState(boundAction, initialActionState);
  const [openState, setOpenState] = useState(false);

  const ids = {
    title: useId(),
    message: useId(),
    link: useId(),
    channel: useId(),
  };

  useEffect(() => {
    if (state.ok) {
      const timer = setTimeout(() => {
        dialogRef.current?.close();
        setOpenState(false);
        router.refresh();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.ok, router]);

  function handleOpen() {
    setOpenState(true);
    dialogRef.current?.showModal();
  }

  function handleClose() {
    dialogRef.current?.close();
    setOpenState(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="flex items-center gap-1.5 border-emerald-600/40 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
        <span>Message User</span>
        {hasTelegram && (
          <span className="ml-1 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
            Telegram
          </span>
        )}
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpenState(false)}
        className="fixed inset-0 m-auto w-full max-w-lg rounded-xl border border-border bg-background p-0 shadow-2xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Send Message to {userName}</h2>
              <p className="text-xs text-muted-foreground">Direct notification via linked channels</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="p-6">
          <div className="space-y-4">
            {/* Linked Channels status banner */}
            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
              <span className="font-medium text-foreground">Available Channels:</span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                  hasTelegram
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-muted text-muted-foreground line-through opacity-70"
                }`}
              >
                <span>Telegram Bot</span>
                {hasTelegram ? "✓" : "✗"}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                  hasPush
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    : "bg-muted text-muted-foreground line-through opacity-70"
                }`}
              >
                <span>Web/FCM Push</span>
                {hasPush ? "✓" : "✗"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                In-App Bell ✓
              </span>
            </div>

            <div>
              <label htmlFor={ids.title} className="block text-xs font-medium text-foreground">
                Notification Title
              </label>
              <input
                id={ids.title}
                name="title"
                required
                maxLength={100}
                placeholder="e.g. Important Account Notice or Support Update"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {state.errors?.title && <p className="mt-1 text-xs text-destructive">{state.errors.title}</p>}
            </div>

            <div>
              <label htmlFor={ids.message} className="block text-xs font-medium text-foreground">
                Message Content
              </label>
              <textarea
                id={ids.message}
                name="message"
                required
                rows={4}
                maxLength={1000}
                placeholder="Write your message here. It will be formatted and delivered straight to the user's Telegram and in-app feed."
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {state.errors?.message && <p className="mt-1 text-xs text-destructive">{state.errors.message}</p>}
            </div>

            <div>
              <label htmlFor={ids.link} className="block text-xs font-medium text-muted-foreground">
                Action URL / Link (Optional)
              </label>
              <input
                id={ids.link}
                name="link"
                type="url"
                placeholder="https://local-rakhal-frontend.rakhal.app/subscription"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {state.message && (
              <p
                role="status"
                className={`rounded-md px-3 py-2 text-xs font-medium ${
                  state.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-destructive/10 text-destructive"
                }`}
              >
                {state.message}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Sending..." : "Dispatch Notification"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
