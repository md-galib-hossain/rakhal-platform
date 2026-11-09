export declare const ARCHIVE_REASONS: readonly ["sold", "deceased", "culled", "archived"];
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];
export declare class ArchiveCattleDto {
    reason?: ArchiveReason;
    notes?: string;
}
