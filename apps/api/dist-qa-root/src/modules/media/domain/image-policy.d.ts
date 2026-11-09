export declare const ALLOWED_INPUT_FORMATS: readonly ["jpeg", "png", "webp"];
export type AllowedFormat = (typeof ALLOWED_INPUT_FORMATS)[number];
export declare const IMAGE_POLICY: {
    readonly limitInputPixels: 25000000;
    readonly full: {
        readonly maxEdge: 1600;
        readonly quality: 82;
    };
    readonly thumb: {
        readonly edge: 320;
        readonly quality: 70;
    };
    readonly outputFormat: "jpeg";
    readonly outputContentType: "image/jpeg";
};
export declare function isAllowedFormat(format?: string): format is AllowedFormat;
