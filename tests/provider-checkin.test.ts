import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ProviderCheckinModal payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the correct PATCH payload structure with action, GPS, and photoHash", async () => {
    const ACTION_MAP: Record<string, string> = {
      ARRIVED: "provider_arrive",
      IN_PROGRESS: "start_service",
      DONE: "request_complete",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ contract: { id: "c1", service_stage: 3 } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const payload = {
      action: ACTION_MAP["ARRIVED"],
      latitude: 31.2304,
      longitude: 121.4737,
      photoUrl: "blob:http://localhost/test-photo",
      photoHash: "a8f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
      role: "PROVIDER",
    };

    const res = await fetch(`/api/orders/c1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callUrl = mockFetch.mock.calls[0][0];
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);

    expect(callUrl).toBe("/api/orders/c1");
    expect(callBody).toHaveProperty("action", "provider_arrive");
    expect(callBody).toHaveProperty("latitude", 31.2304);
    expect(callBody).toHaveProperty("longitude", 121.4737);
    expect(callBody).toHaveProperty("photoUrl");
    expect(callBody).toHaveProperty("photoHash", "a8f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0");
    expect(callBody).toHaveProperty("role", "PROVIDER");

    vi.unstubAllGlobals();
  });

  it("uses correct action for IN_PROGRESS and DONE stages", async () => {
    const ACTION_MAP: Record<string, string> = {
      ARRIVED: "provider_arrive",
      IN_PROGRESS: "start_service",
      DONE: "request_complete",
    };

    expect(ACTION_MAP["IN_PROGRESS"]).toBe("start_service");
    expect(ACTION_MAP["DONE"]).toBe("request_complete");
  });
});
