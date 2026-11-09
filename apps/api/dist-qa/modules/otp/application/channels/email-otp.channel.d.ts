import { EmailService } from 'src/modules/email/application/services/email.service';
import { OtpDeliveryChannel, OtpDeliveryRequest } from '../ports/otp-delivery-channel.port';
export declare class EmailOtpChannel implements OtpDeliveryChannel {
    private readonly email;
    readonly channel: "email";
    constructor(email: EmailService);
    send(request: OtpDeliveryRequest): Promise<void>;
}
