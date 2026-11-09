export declare class PdfGeneratorService {
    generateReportPdf(input: {
        title: string;
        lines: string[];
    }): Promise<Buffer>;
}
