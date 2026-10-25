"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@rakhal/ui/ui/button";
import { sendBroadcastMessage } from "@/lib/actions/communication";
import { initialActionState } from "@/lib/actions/support-state";

export function BroadcastForm({
  telegramSubscribers,
  totalUsers,
}: {
  telegramSubscribers: number;
  totalUsers: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(sendBroadcastMessage, initialActionState);
  const [audience, setAudience] = useState<string>("with_telegram");

  const ids = {
    title: useId(),
    message: useId(),
    link: useId(),
    audience: useId(),
  };

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <label htmlFor={ids.audience} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Target Audience
          </label>
          <select
            id={ids.audience}
            name="targetAudience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="with_telegram">Connected Telegram Users ({telegramSubscribers} subscribers)</option>
            <option value="all">All Active Users ({totalUsers} users)</option>
            <option value="owners">Farm Owners Only</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {audience === "with_telegram" &&
              "Only users who have linked @rakhal_farm_bot on Telegram will receive this notification."}
            {audience === "all" &&
              "Every active farm user will receive this in-app and on their connected external channels."}
            {audience === "owners" && "Targeted exclusively to primary farm creators and administrators."}
          </p>
        </div>

        <div>
          <label htmlFor={ids.title} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Announcement Title
          </label>
          <input
            id={ids.title}
            name="title"
            required
            maxLength={100}
            placeholder="e.g. 📢 Rakhal System Update & New Feature Announcement"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {state.errors?.title && <p className="mt-1 text-xs text-destructive">{state.errors.title}</p>}
        </div>

        <div>
          <label htmlFor={ids.message} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Message Body
          </label>
          <textarea
            id={ids.message}
            name="message"
            required
            rows={5}
            maxLength={1000}
            placeholder="Compose your broadcast message. Use clear language. This will appear as a styled Telegram card and in-app alert."
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {state.errors?.message && <p className="mt-1 text-xs text-destructive">{state.errors.message}</p>}
        </div>

        <div>
          <label htmlFor={ids.link} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Call to Action Link (Optional)
          </label>
          <input
            id={ids.link}
            name="link"
            type="url"
            placeholder="https://local-rakhal-frontend.rakhal.app/dashboard"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {state.message && (
          <div
            role="status"
            className={`rounded-lg p-3 text-sm font-medium ${
              state.ok
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {state.message}
          </div>
        )}

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={pending} className="flex items-center gap-2">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
            <span>{pending ? "Broadcasting..." : "Send Broadcast Now"}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
