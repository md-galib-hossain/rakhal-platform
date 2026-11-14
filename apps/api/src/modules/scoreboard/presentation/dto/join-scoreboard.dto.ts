import { IsBoolean } from 'class-validator';

/** `POST /scoreboard/join` — opt into the national leaderboard (Owner only). */
export class JoinScoreboardDto {
  /** Must be true — explicit data-visibility consent (PRD §18.3). */
  @IsBoolean()
  accept_data_visibility_terms!: boolean;
}
