import { AqrBounds, AqrEventDef, AqrEventKey } from '../../domain/aqr-events';
export interface FarmAqrOverrides {
    events?: Partial<Record<AqrEventKey, AqrEventDef>>;
    bounds?: AqrBounds;
}
export declare class AqrConfigService {
    private readonly overrides;
    resolveEvent(farmId: string, eventKey: AqrEventKey): Promise<AqrEventDef>;
    resolveBounds(farmId: string): Promise<AqrBounds>;
    private overridesFor;
}
