"use client";

import { ActionDialog } from "./action-dialog";
import { SendMessageDialog } from "./send-message-dialog";

/** User support actions. Hidden without `user.manage`; the backend enforces the permission regardless. */
export function UserActions({
  userId,
  name,
  email,
  isBlocked,
  canManage,
  hasTelegram,
  hasPush,
}: {
  userId: string;
  name: string;
  email: string;
  isBlocked: boolean;
  canManage: boolean;
  hasTelegram?: boolean;
  hasPush?: boolean;
}) {
  if (!canManage) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SendMessageDialog
        userId={userId}
        userName={name}
        hasTelegram={hasTelegram}
        hasPush={hasPush}
      />

      {isBlocked ? (
        <ActionDialog
          key="user.unblock"
          kind="user.unblock"
          targetId={userId}
          triggerLabel="Unblock user"
          title="Unblock this user?"
          description="They can sign in again. Any temporary lockout and failed-attempt count are cleared."
          confirmValue={email}
          confirmNoun="email"
          submitLabel="Unblock user"
        />
      ) : (
        <ActionDialog
          key="user.block"
          kind="user.block"
          targetId={userId}
          triggerLabel="Block user"
          title="Block this user?"
          description="They are signed out everywhere immediately and cannot sign in until unblocked."
          confirmValue={email}
          confirmNoun="email"
          submitLabel="Block user"
          danger
        />
      )}

      <ActionDialog
        kind="user.send-password-reset"
        targetId={userId}
        triggerLabel="Send password reset"
        title="Send a password reset email?"
        description="The user gets the normal reset link by email. You never see or set their password."
        confirmValue={email}
        confirmNoun="email"
        submitLabel="Send reset email"
      >
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="revokeSessions" className="mt-1" />
          <span>Also sign them out everywhere (use if the account may be compromised)</span>
        </label>
      </ActionDialog>

      <ActionDialog
        kind="user.revoke-sessions"
        targetId={userId}
        triggerLabel="Sign out everywhere"
        title="Sign this user out everywhere?"
        description="All of their sessions end now. They can sign in again with their password."
        confirmValue={email}
        confirmNoun="email"
        submitLabel="Sign out everywhere"
        danger
      />
    </div>
  );
}
