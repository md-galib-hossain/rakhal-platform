/** `GET /onboarding/invites/:token` (unauthenticated preview). */
export interface InvitePreview {
  farm_name: string;
  role: string;
  invited_by: string;
  status: "pending" | "expired" | "accepted" | "revoked";
  expires_at: string;
}

export interface AcceptInviteResult {
  user: { id: string; email: string; name: string; isEmailVerified: boolean };
  farmId: string;
}
