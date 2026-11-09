export interface EmailProvider {
    sendEmail(input: {
        to: string;
        subject: string;
        html: string;
        attachments?: Array<{
            filename: string;
            content: Buffer;
            contentType: string;
        }>;
    }): Promise<void>;
}
