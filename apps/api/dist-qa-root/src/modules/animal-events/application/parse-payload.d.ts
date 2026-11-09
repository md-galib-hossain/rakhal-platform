import { UnprocessableEntityException } from '@nestjs/common';
export declare function eventError(eventCode: string, message: string, extra?: Record<string, unknown>): UnprocessableEntityException;
export declare function parsePayload<T extends object>(cls: new () => T, raw: Record<string, unknown>): Promise<T>;
