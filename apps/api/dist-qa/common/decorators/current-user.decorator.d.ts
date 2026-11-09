import type { AuthTokenPayload } from 'src/modules/auth/domain/auth-token-payload.type';
export declare const CurrentUser: (...dataOrPipes: (keyof AuthTokenPayload | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>> | undefined)[]) => ParameterDecorator;
export declare const CurrentUserId: (...dataOrPipes: unknown[]) => ParameterDecorator;
