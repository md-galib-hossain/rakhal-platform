"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCursorArgs = getCursorArgs;
exports.toCursorPage = toCursorPage;
const cursor_codec_1 = require("./cursor.codec");
function getCursorArgs(query) {
    const take = query.limit + 1;
    if (!query.cursor) {
        return { take };
    }
    const { id } = (0, cursor_codec_1.decodeCursor)(query.cursor);
    return { take, skip: 1, cursor: { id } };
}
function toCursorPage(rows, query) {
    const hasNextPage = rows.length > query.limit;
    const items = hasNextPage ? rows.slice(0, query.limit) : rows;
    return {
        items,
        meta: {
            count: items.length,
            limit: query.limit,
            hasNextPage,
            hasPreviousPage: Boolean(query.cursor),
            startCursor: items.length ? (0, cursor_codec_1.encodeCursor)({ id: items[0].id }) : null,
            endCursor: items.length
                ? (0, cursor_codec_1.encodeCursor)({ id: items[items.length - 1].id })
                : null,
        },
    };
}
//# sourceMappingURL=cursor-pagination.util.js.map