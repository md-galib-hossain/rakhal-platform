import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import type { EventRequest } from "../forms/types";

const create = vi.fn();
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  eventsApi: { create: (...args: unknown[]) => create(...args) as Promise<unknown>, dryRun: vi.fn(), void: vi.fn() },
}));

import { useRecordEvent } from "./use-record-event";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
);

const request: EventRequest = {
  type: "BREEDING",
  eventAt: "2026-10-30T07:00:00.000Z",
  provenance: "RECORDED",
  payload: { breedingMethod: "AI" },
  followUps: [{ ruleKey: "PREG_CHECK_AFTER_BREEDING", enabled: false }],
};

beforeEach(() => vi.clearAllMocks());

describe("useRecordEvent follow-up toggles", () => {
  it("retries without followUps when the server rejects the unknown property, with the same idempotency key", async () => {
    create
      .mockRejectedValueOnce(new ApiError("VALIDATION_ERROR", "property followUps should not exist", 400))
      .mockResolvedValueOnce({ ref: "e1" });
    const { result } = renderHook(() => useRecordEvent("c1", "SERVICE"), { wrapper });
    const outcome = await result.current.mutateAsync({ request, idempotencyKey: "key-1" });
    expect(outcome).toEqual({ via: "route", body: { ref: "e1" } });
    expect(create).toHaveBeenCalledTimes(2);
    expect((create.mock.calls[0][1] as EventRequest).followUps).toBeDefined();
    expect((create.mock.calls[1][1] as EventRequest).followUps).toBeUndefined();
    expect(create.mock.calls[1][2]).toBe("key-1");
  });

  it("does not retry other validation errors", async () => {
    create.mockRejectedValueOnce(new ApiError("VALIDATION_ERROR", "serviceCost is required", 400));
    const { result } = renderHook(() => useRecordEvent("c1", "SERVICE"), { wrapper });
    await expect(result.current.mutateAsync({ request, idempotencyKey: "key-2" })).rejects.toThrow("serviceCost is required");
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });
});
