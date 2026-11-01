import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAnimal } from "./invalidate-animal";

function seeded() {
  const qc = new QueryClient();
  const keys = [
    ["cattle", "detail", "c1"],
    ["cattle", "overview", "c1"],
    ["cattle", "detail", "c2"],
    ["cattle", "list", { a: "b" }],
    ["cattle", "highlights"],
    ["cattle", "breeds"],
    ["events", "timeline", "c1", {}],
    ["events", "timeline", "c2", {}],
    ["tasks", "list"],
    ["milk", "log"],
  ];
  for (const k of keys) qc.setQueryData(k, 1);
  return qc;
}
const stale = (qc: QueryClient) =>
  qc
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.isInvalidated)
    .map((q) => JSON.stringify(q.queryKey));

describe("invalidateAnimal", () => {
  it("refetches that animal, the lists and the extra keys — not other animals or farm lookups", () => {
    const qc = seeded();
    invalidateAnimal(qc, "c1", ["tasks"]);
    const hit = stale(qc);
    expect(hit).toContain('["cattle","detail","c1"]');
    expect(hit).toContain('["cattle","overview","c1"]');
    expect(hit).toContain('["cattle","highlights"]');
    expect(hit).toContain('["events","timeline","c1",{}]');
    expect(hit).toContain('["tasks","list"]');
    expect(hit).not.toContain('["cattle","detail","c2"]');
    expect(hit).not.toContain('["cattle","breeds"]');
    expect(hit).not.toContain('["events","timeline","c2",{}]');
    expect(hit).not.toContain('["milk","log"]');
  });

  it("without an id still spares the farm-wide lookups", () => {
    const qc = seeded();
    invalidateAnimal(qc, undefined);
    expect(stale(qc)).not.toContain('["cattle","breeds"]');
    expect(stale(qc)).toContain('["cattle","detail","c2"]');
  });
});
