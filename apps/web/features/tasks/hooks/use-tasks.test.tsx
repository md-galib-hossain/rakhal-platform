import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("../api", () => ({
  tasksApi: {
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    complete: vi.fn().mockResolvedValue({}),
    reopen: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({ deleted: true }),
  },
}));

import { useCancelTask, useCompleteTask, useCreateTask, useDeleteTask, useReopenTask, useUpdateTask } from "./use-tasks";

function setup() {
  const client = new QueryClient();
  const spy = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { spy, wrapper };
}
const keys = (spy: ReturnType<typeof setup>["spy"]) => spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));

const EXPECTED = ['["tasks","list"]', '["tasks","detail"]', '["cattle"]', '["health"]', '["dashboard"]'];

describe("task mutations refresh dependent views", () => {
  const cases: [string, () => unknown, (r: never) => Promise<unknown>][] = [
    ["create", () => useCreateTask(), (r) => (r as ReturnType<typeof useCreateTask>).mutateAsync({ name: "x" } as never)],
    ["update", () => useUpdateTask(), (r) => (r as ReturnType<typeof useUpdateTask>).mutateAsync({ id: "t1", dto: {} })],
    ["complete", () => useCompleteTask(), (r) => (r as ReturnType<typeof useCompleteTask>).mutateAsync({ id: "t1", dto: {} })],
    ["reopen", () => useReopenTask(), (r) => (r as ReturnType<typeof useReopenTask>).mutateAsync("t1")],
    ["cancel", () => useCancelTask(), (r) => (r as ReturnType<typeof useCancelTask>).mutateAsync({ id: "t1", dto: {} })],
    ["delete", () => useDeleteTask(), (r) => (r as ReturnType<typeof useDeleteTask>).mutateAsync("t1")],
  ];
  it.each(cases)("%s invalidates tasks list+detail, cattle (Next up), health and dashboard", async (_name, hook, run) => {
    const { spy, wrapper } = setup();
    const { result } = renderHook(hook as () => never, { wrapper });
    await act(async () => void (await run(result.current)));
    expect(keys(spy)).toEqual(expect.arrayContaining(EXPECTED));
  });
});
