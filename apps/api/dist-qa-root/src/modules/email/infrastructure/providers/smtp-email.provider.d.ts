import { EmailProvider } from '../../application/ports/email-provider.port';
export declare class SmtpEmailProvider implements EmailProvider {
    sendEmail(): Promise<void>;
}
