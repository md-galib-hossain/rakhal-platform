import { ScoreboardService } from '../../application/services/scoreboard.service';
import { JoinScoreboardDto } from '../dto/join-scoreboard.dto';
import { LeaderboardQueryDto } from '../dto/leaderboard-query.dto';
export declare class ScoreboardController {
    private readonly scoreboard;
    constructor(scoreboard: ScoreboardService);
    highlights(farmId: string): Promise<{
        top_tier_cows_count: number;
        best_performing_cow: {
            id: string;
            name: string;
            aqr_score: number;
        } | null;
        best_performing_farm_in_district: {
            name: string | null;
            avg_aqr: number;
        } | null;
        avg_herd_aqr: number | null;
        aqr_change_pct: null;
        change_period: string;
        leaderboard_joined: boolean;
    }>;
    leaderboard(farmId: string, query: LeaderboardQueryDto): Promise<{
        scope: import("../dto/leaderboard-query.dto").ScoreboardScope;
        view: "top_firms";
        own_farm_id: string;
        entries: {
            rank: number;
            rank_trend: string;
            farm_id: string;
            farm_name: string | null;
            district: string | null;
            avg_aqr: number;
            cattle_count: number;
            is_own: boolean;
        }[];
        meta: {
            page: number;
            per_page: number;
            total: number;
        };
    } | {
        scope: import("../dto/leaderboard-query.dto").ScoreboardScope;
        view: "star_cows";
        own_farm_id: string;
        entries: {
            rank: number;
            rank_trend: string;
            cattle_id: string;
            name: string;
            tag: string;
            breed: string | null;
            farm_name: string;
            district: string | null;
            aqr_score: number;
            milk_production_l_day: number;
            market_value: null;
            is_own: boolean;
        }[];
        meta: {
            page: number;
            per_page: number;
            total: number;
        };
    }>;
    join(farmId: string, userId: string, dto: JoinScoreboardDto): Promise<{
        leaderboard_joined: boolean;
        visible_from: Date;
    }>;
    leave(farmId: string): Promise<{
        leaderboard_joined: boolean;
    }>;
}
