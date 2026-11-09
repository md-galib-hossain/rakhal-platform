import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  closeNotificationSheet,
  openNotificationSheet,
  openRemindMe,
  setNotificationSheetView,
  useNotificationSheetState,
} from "./sheet-store";

describe("notification sheet store", () => {
  afterEach(() => act(() => closeNotificationSheet()));

  it("opens on the tabs by default and can deep-open the settings view", () => {
    const { result } = renderHook(() => useNotificationSheetState());
    expect(result.current).toEqual({ open: false, view: "tabs", compose: null });

    act(() => openNotificationSheet());
    expect(result.current).toEqual({ open: true, view: "tabs", compose: null });

    act(() => setNotificationSheetView("settings"));
    expect(result.current.view).toBe("settings");

    act(() => closeNotificationSheet());
    expect(result.current).toEqual({ open: false, view: "tabs", compose: null });

    act(() => openNotificationSheet("settings"));
    expect(result.current).toEqual({ open: true, view: "settings", compose: null });
  });

  it("openRemindMe opens the tabs with the anchor, and closing clears it", () => {
    const { result } = renderHook(() => useNotificationSheetState());
    const anchor = { type: "TASK" as const, id: "t1", label: "Vaccinate" };
    act(() => openRemindMe({ anchor }));
    expect(result.current.open).toBe(true);
    expect(result.current.view).toBe("tabs");
    expect(result.current.compose?.anchor).toEqual(anchor);

    act(() => closeNotificationSheet());
    expect(result.current.compose).toBeNull();
  });
});
