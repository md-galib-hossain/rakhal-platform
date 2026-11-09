import { OtpService } from '../../application/services/otp.service';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
export declare class OtpController {
    private readonly otp;
    constructor(otp: OtpService);
    request(userId: string): Promise<import("../../application/services/otp.service").OtpRequestResult>;
    verify(userId: string, dto: VerifyOtpDto): Promise<{
        verified: boolean;
    }>;
}
