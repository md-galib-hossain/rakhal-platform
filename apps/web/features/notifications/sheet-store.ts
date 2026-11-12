import { useSyncExternalStore } from "react";
import type { ComposerAnchor, ComposerAnimal } from "./schedule-model";

export type NotificationSheetView = "tabs" | "settings";

/** A "Remind me" request: open the New tab prefilled with what the notice is relative to (and/or an animal). */
export interface RemindMeRequest {
  anchor?: ComposerAnchor | null;
  animal?: ComposerAnimal;
}

interface SheetState {
  open: boolean;
  view: NotificationSheetView;
  /** Set by `openRemindMe`; the sheet jumps to the New tab and prefills the composer. Cleared on close. */
  compose: RemindMeRequest | null;
}

const SERVER_STATE: SheetState = { open: false, view: "tabs", compose: null };
let state: SheetState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(next: SheetState) {
  if (next.open === state.open && next.view === state.view && next.compose === state.compose) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Shared open/view state of the notification sheet, so the topbar bell and the Settings tab (and any later
 * "remind me" entry point) drive the same sheet without prop drilling across the layout. */
export function useNotificationSheetState(): SheetState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

export function openNotificationSheet(view: NotificationSheetView = "tabs") {
  set({ open: true, view, compose: null });
}

/** Every "Remind me" entry point (task, animal event, health step, animal) calls this instead of building its own form. */
export function openRemindMe(request: RemindMeRequest = {}) {
  set({ open: true, view: "tabs", compose: { ...request } });
}

/** Closing always resets to the tabs, so the next open starts on the Inbox. */
export function closeNotificationSheet() {
  set({ open: false, view: "tabs", compose: null });
}

export function setNotificationSheetView(view: NotificationSheetView) {
  set({ ...state, view });
}
