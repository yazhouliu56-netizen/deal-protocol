// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

import StagedVerification from "@/app/verification/_components/StagedVerification";

function mountStage(stage: { phoneDone: boolean; idDone: boolean; faceDone: boolean; approved: boolean }) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<StagedVerification stage={stage} onChanged={() => {}} />);
  });
  return { container, root };
}

const EMPTY = { phoneDone: false, idDone: false, faceDone: false, approved: false };

describe("StagedVerification 三步渐进实名", () => {
  it("三步进度＋四卡全渲染（缺省未完成态）", () => {
    const { container } = mountStage(EMPTY);
    expect(container.querySelector('[data-testid="verify-progress"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="verify-step-phone"]')?.getAttribute("data-done")).toBe("false");
    expect(container.querySelector('[data-testid="verify-card-phone"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="verify-card-id"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="verify-card-face"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="verify-card-cert"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="verify-phone-go"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="verify-all-done"]')).toBeFalsy();
  });

  it("完成态打勾＋自动通过横幅", () => {
    const { container } = mountStage({ phoneDone: true, idDone: true, faceDone: true, approved: true });
    expect(container.querySelector('[data-testid="verify-step-phone"]')?.getAttribute("data-done")).toBe("true");
    expect(container.querySelector('[data-testid="verify-step-id"]')?.getAttribute("data-done")).toBe("true");
    expect(container.querySelector('[data-testid="verify-step-face"]')?.getAttribute("data-done")).toBe("true");
    expect(container.querySelector('[data-testid="verify-all-done"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="verify-phone-go"]')).toBeFalsy();
  });
});
