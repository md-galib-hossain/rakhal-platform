/**
 * MILESTONE 31 (RFE-154) — the old narrow 8-tab drawer is now the Animal Workspace
 * (`../workspace/animal-workspace.tsx`). This module keeps the `CattleDetailSheet` name and props so
 * `CattleDetailModalProvider` (the `?view=<id>` owner) and its dynamic import are unchanged; the old
 * `cattle-detail-tabs.tsx` and the per-tab files are removed in RFE-166.
 */
// The provider loads this module with a dynamic import and the sections reuse components that call back into the provider.
// eslint-disable-next-line import/no-cycle
export { AnimalWorkspace as CattleDetailSheet } from "../workspace/animal-workspace";
