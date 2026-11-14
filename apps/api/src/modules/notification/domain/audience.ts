/**
 * Notifications v2 audience rules (RAKHAL-492, docs/EPIC_NOTIFICATIONS_V2.md §3.3 step 4 and §3.8). Pure.
 *
 * Recipients are re-resolved at fire time against current membership, never trusted from the write-time list: a
 * removed or deactivated user receives nothing, and a role audience follows role changes.
 */

export type AudienceMode = 'SOURCE' | 'USER' | 'ROLES' | 'USERS';

export const DEFAULT_SOURCE_ROLES = ['Owner', 'Manager'] as const;
export const MAX_RECIPIENTS = 100;

export interface AudienceMember {
  userId: string;
  /** Role names the member holds in this farm. */
  roles: readonly string[];
  /** false = deactivated / removed from the farm. */
  active: boolean;
}

export interface AudienceSpec {
  mode: AudienceMode;
  /** USER (first entry) / USERS. For SOURCE this is only a display hint and is ignored. */
  userIds: readonly string[];
  /** ROLES; for SOURCE: extra roles the resolver wants in addition to its own users. */
  roles: readonly string[];
  /** SOURCE only: users the resolver picked (assignee etc.). */
  sourceUserIds?: readonly string[];
}

function membersWithRoles(
  members: readonly AudienceMember[],
  roles: readonly string[],
): string[] {
  const wanted = new Set(roles);
  return members
    .filter((m) => m.active && m.roles.some((r) => wanted.has(r)))
    .map((m) => m.userId);
}

/**
 * Current recipients for an audience: de-duplicated, sorted, restricted to active members of the farm.
 * SOURCE = the resolver's users (active ones) plus `roles` members; if that leaves nobody, Owner + Manager.
 */
export function resolveAudience(
  spec: AudienceSpec,
  members: readonly AudienceMember[],
): string[] {
  const activeIds = new Set(
    members.filter((m) => m.active).map((m) => m.userId),
  );
  const keepActive = (ids: readonly string[]) =>
    ids.filter((id) => activeIds.has(id));

  let result: string[];
  switch (spec.mode) {
    case 'USER':
      result = keepActive(spec.userIds.slice(0, 1));
      break;
    case 'USERS':
      result = keepActive(spec.userIds);
      break;
    case 'ROLES':
      result = membersWithRoles(members, spec.roles);
      break;
    case 'SOURCE':
      result = [
        ...keepActive(spec.sourceUserIds ?? []),
        ...membersWithRoles(members, spec.roles),
      ];
      if (result.length === 0) {
        result = membersWithRoles(members, DEFAULT_SOURCE_ROLES);
      }
      break;
  }
  return [...new Set(result)].sort();
}

// ---------------------------------------------------------------------------------------------------------------
// Write-time permission rules for manual (USER) schedules
// ---------------------------------------------------------------------------------------------------------------

export type AudienceWriteError =
  | 'AUDIENCE_SOURCE_NOT_ALLOWED'
  | 'AUDIENCE_USER_REQUIRED'
  | 'AUDIENCE_USERS_REQUIRED'
  | 'AUDIENCE_ROLES_REQUIRED'
  | 'AUDIENCE_TOO_MANY'
  | 'AUDIENCE_FORBIDDEN';

/**
 * Shape + permission check for a manual schedule's audience. `canManage` = holds `notification.manage`
 * (Owner/Manager): may target other users or roles. Without it (Worker) only `USER` with `userId = self` is allowed.
 * Existence of the ids in the farm is checked by the service (404, so other farms' ids are never confirmed).
 */
export function validateManualAudience(
  spec: Pick<AudienceSpec, 'mode' | 'userIds' | 'roles'>,
  actorUserId: string,
  canManage: boolean,
): AudienceWriteError | null {
  switch (spec.mode) {
    case 'SOURCE':
      return 'AUDIENCE_SOURCE_NOT_ALLOWED';
    case 'USER':
      if (spec.userIds.length !== 1) return 'AUDIENCE_USER_REQUIRED';
      if (!canManage && spec.userIds[0] !== actorUserId) {
        return 'AUDIENCE_FORBIDDEN';
      }
      return null;
    case 'USERS':
      if (spec.userIds.length === 0) return 'AUDIENCE_USERS_REQUIRED';
      if (spec.userIds.length > MAX_RECIPIENTS) return 'AUDIENCE_TOO_MANY';
      return canManage ? null : 'AUDIENCE_FORBIDDEN';
    case 'ROLES':
      if (spec.roles.length === 0) return 'AUDIENCE_ROLES_REQUIRED';
      return canManage ? null : 'AUDIENCE_FORBIDDEN';
  }
}
