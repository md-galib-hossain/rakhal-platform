import { describe, expect, it } from "vitest";
import { notificationAction } from "./notification-action";

describe("notificationAction", () => {
  it("record link carries animal, form key and reminder ref", () => {
    expect(notificationAction("/animals?view=c1&record=PREG_CHECK&ref=r9")).toEqual({
      kind: "record",
      href: "/animals?view=c1&record=PREG_CHECK&ref=r9",
      animalId: "c1",
      recordKey: "PREG_CHECK",
      ref: "r9",
    });
  });
  it("record link without ref", () => {
    const a = notificationAction("/animals?view=c1&record=HEAT");
    expect(a.kind === "record" && a.ref).toBeNull();
  });
  it("view only opens the workspace", () => {
    expect(notificationAction("/animals?view=c1").kind).toBe("animal");
  });
  it("grouped row opens the filtered list", () => {
    expect(notificationAction("/animals?reproductiveStatus=INSEMINATED").kind).toBe("list");
    expect(notificationAction("/animals").kind).toBe("list");
  });
  it("other in-app paths stay plain links", () => {
    expect(notificationAction("/tasks")).toEqual({ kind: "link", href: "/tasks" });
  });
  it("info-only and unsafe links have no action", () => {
    expect(notificationAction(null).kind).toBe("none");
    expect(notificationAction("").kind).toBe("none");
    expect(notificationAction("https://evil.example/x").kind).toBe("none");
    expect(notificationAction("//evil.example").kind).toBe("none");
    expect(notificationAction("javascript:alert(1)").kind).toBe("none");
  });
});
