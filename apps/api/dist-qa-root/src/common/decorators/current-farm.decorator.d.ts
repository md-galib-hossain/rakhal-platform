import type { VerifiedFarmContext } from 'src/modules/tenant-access/domain/verified-farm-context.type';
export declare const CurrentFarm: (...dataOrPipes: (keyof VerifiedFarmContext | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>> | undefined)[]) => ParameterDecorator;
export declare const CurrentFarmId: (...dataOrPipes: unknown[]) => ParameterDecorator;
