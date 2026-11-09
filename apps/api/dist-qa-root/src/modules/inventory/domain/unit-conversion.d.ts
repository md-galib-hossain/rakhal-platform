export interface UnitLike {
    id: string;
    symbol?: string;
    dimension: 'WEIGHT' | 'VOLUME' | 'COUNT';
    conversionToBase: number | null;
}
export declare function unitsCompatible(from: UnitLike, to: UnitLike): boolean;
export declare function convertQuantity(quantity: number, from: UnitLike, to: UnitLike): number;
