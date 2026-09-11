// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClaimDemand } from "@/hooks/useClaimDemand";

function mountClaim(scenario: "ok" | "taken" | "down", events: string[]) {
  const fetchMock = vi.fn(async () => {
    if (scenario === "down") throw new Error("net");
    return {
      ok: scenario === "ok",
      json: async () => (scenario === "ok" ? {} : { reason: "手慢了" }),
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  function Probe() {
    const { claim } = useClaimDemand({
      onSuccess: () => void events.push("success"),
      onFailure: () => void events.push("failure"),
      onOptimistic: () => void events.push("optimistic"),
      onRollback: () => void events.push("rollback"),
    });
    return <button type="button" onClick={() => void claim("d1")} />;
  }
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => void root.render(<Probe />));
  return { el, root, fire: () => act(() => void el.querySelector("button")!.click()) };
}

describe("useClaimDemand 乐观抢单时序", () => {
  beforeEach(() => void vi.unstubAllGlobals());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("成功：optimistic 先行，成功后不回滚", async () => {
    const events: string[] = [];
    const { fire } = mountClaim("ok", events);
    fire();
    await act(async () => {});
    expect(events).toEqual(["optimistic", "success"]);
  });

  it("被抢（409）：optimistic → rollback → failure", async () => {
    const events: string[] = [];
    const { fire } = mountClaim("taken", events);
    fire();
    await act(async () => {});
    expect(events).toEqual(["optimistic", "rollback", "failure"]);
  });

  it("断网：optimistic → rollback → failure", async () => {
    const events: string[] = [];
    const { fire } = mountClaim("down", events);
    fire();
    await act(async () => {});
    expect(events).toEqual(["optimistic", "rollback", "failure"]);
  });
});
