import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `GET /admin/admins` — cursor pagination only (admins are few; no filters yet). */
export class ListAdminsQueryDto extends CursorPaginationQueryDto {}
