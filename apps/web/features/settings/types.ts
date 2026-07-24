/** Settings tab-rail (Figma `1039:51236`). Only `billing` has real content this pass (RFE-036); the
 * other three are the rest of RFE-045 and render a placeholder for now. */
export const SETTINGS_TABS = ["workspace", "team", "modules", "billing"] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number];
