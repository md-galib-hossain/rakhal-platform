export interface EventApiContext {
    historical: boolean;
}
export declare const runInEventApi: <T>(ctx: EventApiContext, fn: () => Promise<T>) => Promise<T>;
export declare const eventApiContext: () => EventApiContext | undefined;
