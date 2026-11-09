export interface RecipeLineRef {
    ingredientId: string | null;
    feedItemId: string | null;
    feedItemBatchId?: string | null;
}
export declare function lineKey(line: RecipeLineRef): string;
export declare const isLotBacked: (line: RecipeLineRef) => boolean;
