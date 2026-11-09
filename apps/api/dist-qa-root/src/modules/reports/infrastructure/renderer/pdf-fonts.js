"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FONT_POSTSCRIPT_NAME = exports.FONT_BOLD_FILE = exports.FONT_REGULAR_FILE = void 0;
exports.fontDirCandidates = fontDirCandidates;
exports.resolveFontDir = resolveFontDir;
exports.resolveFontPaths = resolveFontPaths;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
exports.FONT_REGULAR_FILE = 'NotoSansBengali-Regular.ttf';
exports.FONT_BOLD_FILE = 'NotoSansBengali-Bold.ttf';
exports.FONT_POSTSCRIPT_NAME = 'NotoSansBengali';
function fontDirCandidates(from = __dirname) {
    return [
        (0, node_path_1.join)(from, '..', '..', '..', '..', 'assets', 'fonts'),
        (0, node_path_1.join)(from, '..', '..', '..', '..', '..', 'assets', 'fonts'),
        (0, node_path_1.join)(process.cwd(), 'assets', 'fonts'),
    ];
}
function resolveFontDir(from = __dirname) {
    for (const dir of fontDirCandidates(from)) {
        if ((0, node_fs_1.existsSync)((0, node_path_1.join)(dir, exports.FONT_REGULAR_FILE)) &&
            (0, node_fs_1.existsSync)((0, node_path_1.join)(dir, exports.FONT_BOLD_FILE))) {
            return dir;
        }
    }
    throw new Error('Report font files were not found.');
}
function resolveFontPaths(from = __dirname) {
    const dir = resolveFontDir(from);
    return {
        regular: (0, node_path_1.join)(dir, exports.FONT_REGULAR_FILE),
        bold: (0, node_path_1.join)(dir, exports.FONT_BOLD_FILE),
    };
}
//# sourceMappingURL=pdf-fonts.js.map