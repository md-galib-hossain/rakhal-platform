export type ScoreboardScope = 'national' | 'district' | 'division';
export type ScoreboardView = 'star_cows' | 'top_firms';
export declare class LeaderboardQueryDto {
    scope: ScoreboardScope;
    view: ScoreboardView;
    page: number;
    per_page: number;
}
