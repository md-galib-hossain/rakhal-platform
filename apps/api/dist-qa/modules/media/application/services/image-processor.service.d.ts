export interface ProcessedVariant {
    buffer: Buffer;
    width: number;
    height: number;
    byteSize: number;
}
export interface ProcessedImage {
    full: ProcessedVariant;
    thumb: ProcessedVariant;
    detectedFormat: string;
}
export declare class ImageProcessorService {
    process(input: Buffer): Promise<ProcessedImage>;
}
