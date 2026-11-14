import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `GET /feed/cattle/:cattleId/requirement-overrides` — cursor-paginated history, newest first. */
export class RequirementOverrideHistoryQueryDto extends CursorPaginationQueryDto {}
