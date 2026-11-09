export declare const FONT_REGULAR_FILE = "NotoSansBengali-Regular.ttf";
export declare const FONT_BOLD_FILE = "NotoSansBengali-Bold.ttf";
export declare const FONT_POSTSCRIPT_NAME = "NotoSansBengali";
export declare function fontDirCandidates(from?: string): string[];
export declare function resolveFontDir(from?: string): string;
export declare function resolveFontPaths(from?: string): {
    regular: string;
    bold: string;
};
