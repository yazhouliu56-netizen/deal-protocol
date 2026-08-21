// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import ProofCamera, { type IProofCaptureResult } from "@/components/oto-ui/controls/ProofCamera";
import type { IImageForgeryReport } from "@/base/ai/forgery";

function mountProofCamera(props: Parameters<typeof ProofCamera>[0]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ProofCamera {...props} />);
  });
  return { container, root, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const MOCK_WATERMARK_RESULT = {
  blob: null as Blob | null,
  dataUrl: "data:image/jpeg;base64,MOCKDATA",
  sha256: "ab".repeat(32),
  watermarkApplied: true,
  width: 800,
  height: 600,
  lines: ["[时间] 2026-08-21 10:00:00", "[坐标] 31.23040°N 121.47370°E", "[订单] wm-a1b2c3d4e5f6"],
};

const LOW_REPORT: IImageForgeryReport = {
  isAuthentic: true,
  overallConfidence: 0.92,
  riskLevel: "LOW",
  signals: [],
  tamperFlags: [],
  summaryDiagnosis: "五信号全部通过",
};

const CRITICAL_REPORT: IImageForgeryReport = {
  isAuthentic: false,
  overallConfidence: 0.18,
  riskLevel: "CRITICAL",
  signals: [],
  tamperFlags: ["HASH_TAMPERED", "AI_ARTIFACT_SUSPICION"],
  summaryDiagnosis: "命中 2 项疑点",
};

describe("ProofCamera P0-3/P1-1 全链贯通：水印压制 → SHA-256 → 五信号快筛 → 存证载荷", () => {
  it("正常水印 + LOW 鉴真：预览显示 🔬 鉴真徽标 92% · LOW + SHA 标签", async () => {
    const watermarkFn = vi.fn().mockResolvedValue(MOCK_WATERMARK_RESULT);
    const forgeryFn = vi.fn().mockResolvedValue(LOW_REPORT);
    const onCaptured = vi.fn();
    const { container, unmount } = mountProofCamera({
      orderNo: "order-chain-1",
      geo: { lat: 31.2304, lng: 121.4737, accuracyMeters: 15 },
      watermarkFn,
      forgeryFn,
      onCaptured,
    });
    const file = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // 预览立即可见（水印后即 preview，鉴真异步补徽标）
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(watermarkFn).toHaveBeenCalledTimes(1);
    const [, opts] = watermarkFn.mock.calls[0] as [Blob, { lat: number; lng: number; orderNo: string }];
    expect(opts.lat).toBe(31.2304);
    expect(opts.orderNo).toBe("order-chain-1");
    expect(forgeryFn).toHaveBeenCalledTimes(1);
    const forgeryInput = forgeryFn.mock.calls[0][0] as { actualSha256: string; exif: { watermarkCode: string } };
    expect(forgeryInput.actualSha256).toBe("ab".repeat(32));
    expect(typeof forgeryInput.exif.watermarkCode).toBe("string");
    // 鉴真徽标
    expect(container.querySelector('[data-testid="proof-forgery"]')).not.toBeNull();
    expect(container.querySelector('[data-forgery-badge]')!.textContent).toContain("92%");
    expect(container.querySelector('[data-forgery-badge]')!.textContent).toContain("LOW");
    expect(container.querySelector('[data-sha-tag]')!.textContent).toContain("ab".repeat(6).slice(0, 12));
    expect(container.querySelector('[data-testid="proof-hash"]')!.textContent).toContain("ab".repeat(8).slice(0, 16));
    unmount();
  });

  it("CRITICAL 伪造：显示疑似伪造拦截告警 + 确认按钮变危险态", async () => {
    const watermarkFn = vi.fn().mockResolvedValue(MOCK_WATERMARK_RESULT);
    const forgeryFn = vi.fn().mockResolvedValue(CRITICAL_REPORT);
    const { container, unmount } = mountProofCamera({
      orderNo: "order-chain-critical",
      watermarkFn,
      forgeryFn,
    });
    const file = new File(["fake"], "fake.jpg", { type: "image/jpeg" });
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(container.querySelector('[data-testid="proof-critical"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="proof-critical"]')!.textContent).toContain("CRITICAL");
    expect(container.querySelector('[data-testid="proof-critical"]')!.textContent).toContain("HASH_TAMPERED");
    const confirmBtn = container.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;
    expect(confirmBtn.textContent).toContain("仍确认使用");
    expect(confirmBtn.className).toContain("proof-camera-btn-danger");
    unmount();
  });

  it("确认使用：onCaptured 收到完整 IProofCaptureResult 结构化载荷", async () => {
    const watermarkFn = vi.fn().mockResolvedValue({ ...MOCK_WATERMARK_RESULT, sha256: "cd".repeat(32) });
    const forgeryFn = vi.fn().mockResolvedValue({ ...LOW_REPORT, overallConfidence: 0.88 });
    const onCaptured = vi.fn();
    const { container, unmount } = mountProofCamera({
      orderNo: "order-chain-capture",
      geo: { lat: 39.9042, lng: 116.4074, accuracyMeters: 20 },
      watermarkFn,
      forgeryFn,
      onCaptured,
    });
    const file = new File(["proof"], "p.jpg", { type: "image/jpeg" });
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.click();
    });
    expect(onCaptured).toHaveBeenCalledTimes(1);
    const result = onCaptured.mock.calls[0][0] as IProofCaptureResult;
    expect(result.sha256).toBe("cd".repeat(32));
    expect(result.dataUrl).toBe("data:image/jpeg;base64,MOCKDATA");
    expect(typeof result.capturedAt).toBe("string");
    expect(new Date(result.capturedAt).toString()).not.toBe("Invalid Date");
    expect(result.coords.lat).toBe(39.9042);
    expect(result.coords.lng).toBe(116.4074);
    expect(result.coords.accuracyMeters).toBe(20);
    expect(result.forgeryReport.riskLevel).toBe("LOW");
    expect(result.forgeryReport.overallConfidence).toBe(0.88);
    expect(result.watermarkApplied).toBe(true);
    expect(result.width).toBe(800);
    expect(result.lines.length).toBe(3);
    // 确认后回 idle
    expect(container.querySelector('[data-testid="proof-camera"]')!.getAttribute("data-phase")).toBe("idle");
    unmount();
  });

  it("强制环境相机语义：input capture=environment 且 48px 触控 + 防偷懒无 TODO", async () => {
    const { container, unmount } = mountProofCamera({ orderNo: "order-env" });
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    expect(input.getAttribute("capture")).toBe("environment");
    expect(input.accept).toBe("image/*");
    const btn = container.querySelector<HTMLButtonElement>('[data-action="capture"]')!;
    expect(Number(btn.style.minHeight.replace("px", ""))).toBeGreaterThanOrEqual(48);
    // 防偷懒：文件内容无省略占位符（静态扫描）
    const fs = await import("fs");
    const path = await import("path");
    const proofFile = fs.readFileSync(path.join(process.cwd(), "src/components/oto-ui/controls/ProofCamera.tsx"), "utf-8");
    expect(proofFile).not.toContain("// TODO");
    expect(proofFile).not.toContain("// ...其余不变");
    expect(proofFile).toContain("IProofCaptureResult");
    expect(proofFile).toContain("detectImageForgery");
    expect(proofFile).toContain("applyTimestampGeoWatermark");
    unmount();
  });

  it("红线 4 零信任：水印/鉴真链路全程不抛未捕获异常，CRITICAL 仍可确认", async () => {
    const watermarkFn = vi.fn().mockResolvedValue(MOCK_WATERMARK_RESULT);
    const forgeryFn = vi.fn().mockResolvedValue(CRITICAL_REPORT);
    const onCaptured = vi.fn();
    const { container, unmount } = mountProofCamera({ orderNo: "order-zero-trust", watermarkFn, forgeryFn, onCaptured });
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    Object.defineProperty(input, "files", { value: [new File(["x"], "x.jpg")] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    // CRITICAL 拦截态仍可操作（不白屏不抛异常）
    expect(container.querySelector('[data-testid="proof-critical"]')).not.toBeNull();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.click();
    });
    expect(onCaptured).toHaveBeenCalledTimes(1);
    const res = onCaptured.mock.calls[0][0] as IProofCaptureResult;
    expect(res.forgeryReport.riskLevel).toBe("CRITICAL");
    unmount();
  });
});
