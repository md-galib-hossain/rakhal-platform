import { IsArray, IsIn } from 'class-validator';

/**
 * `PATCH /settings/modules/milk-sessions` — owner-only (`settings.milk-sessions-manage`).
 * Split out of the general module-settings DTO so Manager+Owner's shared
 * `settings.update` can't touch which milk sessions are active; only the farm
 * Owner can lock/unlock any of the 4 sessions. At least one must stay active,
 * validated server-side, not client-editable — see
 * `WorkspaceSettingsService.updateMilkSessions`.
 */
export class UpdateMilkSessionsDto {
  @IsArray()
  @IsIn(['morning', 'noon', 'evening', 'night'], { each: true })
  active_sessions!: string[];
}
