export function invitationStatus(invite: { status: string; cancelled_at?: string | null; expires_at?: string; invited_user_id?: string | null }, linkedUsers: Set<string>, now: number) {
  if (invite.cancelled_at) return "cancelled";
  if (invite.status === "accepted") return invite.invited_user_id && linkedUsers.has(invite.invited_user_id) ? "access_ready" : "accepted";
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= now) return "expired";
  return invite.status;
}
