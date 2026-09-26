// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import GrabConsole from "./GrabConsole";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
  vi.unstubAllGlobals();
});

function mountConsole() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <GrabConsole
        demandId="d-guard-1"
        initialTimeLeft={60}
        onGrabSuccess={() => {}}
        onGrabFailure={() => {}}
      />,
    );
  });
}

describe("GrabConsole 见面武装接线", () => {
  it("ENHANCED 回执 → 隐私会话落库＋守护横幅", async () => {
    act(() => {
      useIdentityStore.setState((s) => ({ identity: { ...s.identity, id: "u-p-test" } }));
      useWaveStore.setState({ privacySessions: [] });
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          demanderId: "u-c-test",
          meetupGuard: { level: "ENHANCED", reasons: ["first-order"] },
        }),
      })),
    );
    mountConsole();
    const btn = host!.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(host!.querySelector('[data-testid="guard-banner"]')).not.toBeNull();
    expect(host!.querySelector('[data-testid="guard-banner"]')?.textContent).toContain("first-order");
    const sessions = useWaveStore.getState().privacySessions;
    expect(sessions.some((s) => (s as { waveId?: string }).waveId === "d-guard-1")).toBe(true);
  });

  it("STANDARD/缺字段 → 静默无横幅（零打扰）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) })),
    );
    mountConsole();
    const btn = host!.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(host!.querySelector('[data-testid="guard-banner"]')).toBeNull();
  });
});
