// @vitest-environment jsdom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PrePermissionSheet, {
  PERMANENTLY_DENIED_HINT,
  PERMISSION_BUTTON_MIN_HEIGHT_PX,
  PERMISSION_COPY,
} from "@/components/oto-ui/PrePermissionSheet";
import A2HSPrompt, {
  isIosSafari,
  type A2HSPromptHandle,
} from "@/components/oto-ui/A2HSPrompt";
import ProofCamera, {
  CAMERA_BUTTON_MIN_HEIGHT_PX,
} from "@/components/oto-ui/controls/ProofCamera";
import {
  EDGE_SWIPE_THRESHOLD_PX,
  useEdgeSwipeBack,
} from "@/base/platform/useEdgeSwipeBack";

function mount(ui: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(root: ReturnType<typeof createRoot>, container: HTMLDivElement) {
  act(() => root.unmount());
  container.remove();
}

function fireTouch(
  type: "touchstart" | "touchmove" | "touchend",
  points: { clientX: number; clientY: number }[],
) {
  const ev = new Event(type, { cancelable: true }) as unknown as TouchEvent;
  Object.defineProperty(ev, "touches", { value: points });
  Object.defineProperty(ev, "changedTouches", { value: points });
  window.dispatchEvent(ev);
  return ev;
}

describe("PrePermissionSheet 硬件权限预授权浮层", () => {
  it("定位模式：标题 / 业务文案 / 确认按钮语义齐全", () => {
    const html = renderToStaticMarkup(
      <PrePermissionSheet permissionType="GEOLOCATION" isOpen onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(html).toContain(PERMISSION_COPY.GEOLOCATION.title);
    expect(html).toContain(PERMISSION_COPY.GEOLOCATION.body);
    expect(html).toContain(PERMISSION_COPY.GEOLOCATION.confirm);
    expect(html).toContain('data-permission-type="GEOLOCATION"');
    expect(html).toContain("单次定位");
    expect(html).toContain("200米内");
  });

  it("相机模式：防伪物证链文案渲染", () => {
    const html = renderToStaticMarkup(
      <PrePermissionSheet permissionType="CAMERA" isOpen onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(html).toContain(PERMISSION_COPY.CAMERA.body);
    expect(html).toContain("防伪物证链");
    expect(html).toContain("拍照打卡");
    expect(html).toContain('data-permission-type="CAMERA"');
  });

  it("isOpen=false：不渲染任何浮层", () => {
    const html = renderToStaticMarkup(
      <PrePermissionSheet permissionType="CAMERA" isOpen={false} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(html).toBe("");
  });

  it("永久拒绝态：切换为地址栏锁形图标重置指引", () => {
    const html = renderToStaticMarkup(
      <PrePermissionSheet
        permissionType="GEOLOCATION"
        isOpen
        isPermanentlyDenied
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain(PERMANENTLY_DENIED_HINT);
    expect(html).toContain("锁形图标");
    expect(html).toContain("网站设置");
    expect(html).toContain('data-permanently-denied="1"');
  });

  it("确认 / 取消回调触发；按钮触控高度 ≥ 44px 且 tap-highlight 透明", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container, root } = mount(
      <PrePermissionSheet permissionType="CAMERA" isOpen onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    const confirmBtn = container.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;
    const cancelBtn = container.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
    expect(confirmBtn.style.minHeight).toBe(`${PERMISSION_BUTTON_MIN_HEIGHT_PX}px`);
    expect(cancelBtn.style.minHeight).toBe(`${PERMISSION_BUTTON_MIN_HEIGHT_PX}px`);
    expect(Number(confirmBtn.style.minHeight.replace("px", ""))).toBeGreaterThanOrEqual(44);
    await act(async () => confirmBtn.click());
    await act(async () => cancelBtn.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount(root, container);
  });
});

describe("A2HSPrompt 桌面安装价值时刻引导", () => {
  it("isIosSafari 纯函数：iOS Safari 真 / Android 假 / iOS Chrome 假", () => {
    expect(
      isIosSafari("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
    ).toBe(true);
    expect(
      isIosSafari("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"),
    ).toBe(true);
    expect(isIosSafari("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36")).toBe(false);
    expect(isIosSafari("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1")).toBe(false);
  });

  it("iOS Safari 且未 standalone：showInstallPrompt → 底部气泡（分享图标 ➔ 添加至主屏幕）", async () => {
    const handle: { current: A2HSPromptHandle | null } = { current: null };
    const { container, root } = mount(
      <A2HSPrompt
        ref={(h) => {
          handle.current = h;
        }}
        ua="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
      />,
    );
    expect(container.textContent).toBe("");
    await act(async () => handle.current?.showInstallPrompt("FIRST_ORDER_COMPLETED"));
    const bubble = container.querySelector('[data-mode="ios"]');
    expect(bubble).not.toBeNull();
    expect(bubble!.textContent).toContain("添加至主屏幕");
    expect(bubble!.textContent).toContain("分享");
    expect(bubble!.textContent).toContain("添加至主屏幕");
    expect(container.querySelector('[data-mode="native"]')).toBeNull();
    unmount(root, container);
  });

  it("Android：捕获 beforeinstallprompt 并 preventDefault → 价值卡片 → prompt() 原生安装", async () => {
    const onInstalled = vi.fn();
    const promptFn = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { BeforeInstallPromptEvent?: unknown }).BeforeInstallPromptEvent = class BeforeInstallPromptEvent {};
    const handle: { current: A2HSPromptHandle | null } = { current: null };
    const { container, root } = mount(
      <A2HSPrompt ref={(h) => { handle.current = h; }} onInstalled={onInstalled} />,
    );
    const evt = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperty(evt, "prompt", { value: promptFn });
    Object.defineProperty(evt, "userChoice", {
      value: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    await act(async () => {
      window.dispatchEvent(evt);
    });
    expect(evt.defaultPrevented).toBe(true);
    await act(async () => handle.current?.showInstallPrompt("PROVIDER_VERIFIED"));
    const card = container.querySelector('[data-mode="native"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("服务者认证已通过");
    expect(card!.textContent).toContain("立即添加至桌面");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-action="a2hs-install"]')!.click();
    });
    await act(async () => {});
    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(onInstalled).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-mode="native"]')).toBeNull();
    unmount(root, container);
    delete (window as unknown as { BeforeInstallPromptEvent?: unknown }).BeforeInstallPromptEvent;
  });

  it("Android 卡片：稍后再说关闭且不触发安装", async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { BeforeInstallPromptEvent?: unknown }).BeforeInstallPromptEvent = class BeforeInstallPromptEvent {};
    const handle: { current: A2HSPromptHandle | null } = { current: null };
    const { container, root } = mount(
      <A2HSPrompt ref={(h) => { handle.current = h; }} />,
    );
    const evt = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperty(evt, "prompt", { value: promptFn });
    await act(async () => window.dispatchEvent(evt));
    await act(async () => handle.current?.showInstallPrompt("FIRST_ORDER_COMPLETED"));
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-action="a2hs-later"]')!.click();
    });
    expect(container.querySelector('[data-mode="native"]')).toBeNull();
    expect(promptFn).not.toHaveBeenCalled();
    unmount(root, container);
    delete (window as unknown as { BeforeInstallPromptEvent?: unknown }).BeforeInstallPromptEvent;
  });

  it("非 iOS 且无 deferred prompt：showInstallPrompt 不渲染（静默等待原生时机）", async () => {
    const handle: { current: A2HSPromptHandle | null } = { current: null };
    const { container, root } = mount(
      <A2HSPrompt ref={(h) => { handle.current = h; }} ua="Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile Safari/537.36" />,
    );
    await act(async () => handle.current?.showInstallPrompt("FIRST_ORDER_COMPLETED"));
    expect(container.textContent).toBe("");
    unmount(root, container);
  });
});

describe("ProofCamera 4:3 存证水印相机", () => {
  it("idle 渲染：4:3 取景框 + capture=environment 隐式 input + 拍照按钮 ≥48px", async () => {
    const { container, root } = mount(
      <ProofCamera orderNo="order-1" geo={{ lat: 31.2304, lng: 121.4737, accuracyMeters: 25 }} />,
    );
    expect(container.querySelector('[data-testid="proof-camera"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="proof-camera"]')!.getAttribute("data-phase")).toBe("idle");
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    expect(input.type).toBe("file");
    expect(input.accept).toBe("image/*");
    expect(input.getAttribute("capture")).toBe("environment");
    expect(container.textContent).toContain("4:3");
    expect(container.textContent).toContain("禁止相册选取");
    expect(container.querySelector('[data-geo-locked="1"]')).not.toBeNull();
    expect(container.textContent).toContain("GPS 已锁定");
    const captureBtn = container.querySelector<HTMLButtonElement>('[data-action="capture"]')!;
    expect(Number(captureBtn.style.minHeight.replace("px", ""))).toBeGreaterThanOrEqual(CAMERA_BUTTON_MIN_HEIGHT_PX);
    expect(Number(captureBtn.style.minHeight.replace("px", ""))).toBeGreaterThanOrEqual(48);
    unmount(root, container);
  });

  it("geo 缺省：坐标占位标签（不裸奔）", async () => {
    const { container, root } = mount(<ProofCamera orderNo="order-1" />);
    expect(container.querySelector('[data-geo-locked="0"]')).not.toBeNull();
    expect(container.textContent).toContain("定位未就绪 · 坐标占位");
    unmount(root, container);
  });

  it("拍照 → 自动调用水印引擎（File + 时空/订单参数）→ 预览缩略图 + SHA-256 标签", async () => {
    const watermarkFn = vi.fn().mockResolvedValue({
      blob: null,
      dataUrl: "data:image/jpeg;base64,AAAA",
      sha256: "ab".repeat(32),
      watermarkApplied: true,
      width: 640,
      height: 480,
      lines: ["[时间] 2026-08-16 09:08:07", "[坐标] 31.23040°N 121.47370°E ±25m", "[订单] wm-a1b2c3d4e5f6"],
    });
    const onCaptured = vi.fn();
    const { container, root } = mount(
      <ProofCamera
        orderNo="order-1"
        geo={{ lat: 31.2304, lng: 121.4737, accuracyMeters: 25 }}
        watermarkFn={watermarkFn}
        onCaptured={onCaptured}
      />,
    );
    const file = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {});
    expect(watermarkFn).toHaveBeenCalledTimes(1);
    const [src, opts] = watermarkFn.mock.calls[0] as [Blob, Record<string, unknown>];
    expect(src).toBe(file);
    expect(opts.orderNo).toBe("order-1");
    expect(opts.lat).toBe(31.2304);
    expect(opts.lng).toBe(121.4737);
    expect(opts.accuracyMeters).toBe(25);
    expect(typeof opts.timestamp).toBe("number");
    expect(container.querySelector('[data-testid="proof-camera"]')!.getAttribute("data-phase")).toBe("preview");
    const thumb = container.querySelector<HTMLImageElement>('[data-testid="proof-thumb"]')!;
    expect(thumb.src).toContain("data:image/jpeg;base64,AAAA");
    const hash = container.querySelector('[data-testid="proof-hash"]')!.textContent!;
    expect(hash).toContain("SHA-256");
    expect(hash).toContain("abababababababab");
    expect(hash).toContain("640×480");
    expect(container.querySelector('[data-action="retake"]')).not.toBeNull();
    expect(container.querySelector('[data-action="confirm"]')).not.toBeNull();
    unmount(root, container);
  });

  it("确认使用：onCaptured 携带哈希结果并重置回拍照态", async () => {
    const watermarkFn = vi.fn().mockResolvedValue({
      blob: null,
      dataUrl: "data:image/jpeg;base64,BBBB",
      sha256: "cd".repeat(32),
      watermarkApplied: true,
      width: 640,
      height: 480,
      lines: ["[时间] 2026-08-16 09:08:07", "[坐标] 31.23040°N 121.47370°E", "[订单] wm-a1b2c3d4e5f6"],
    });
    const onCaptured = vi.fn();
    const { container, root } = mount(
      <ProofCamera orderNo="order-1" geo={{ lat: 31.2304, lng: 121.4737 }} watermarkFn={watermarkFn} onCaptured={onCaptured} />,
    );
    const file = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => {});
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.click();
    });
    expect(onCaptured).toHaveBeenCalledTimes(1);
    expect(onCaptured.mock.calls[0]![0].sha256).toBe("cd".repeat(32));
    expect(container.querySelector('[data-testid="proof-camera"]')!.getAttribute("data-phase")).toBe("idle");
    expect(container.querySelector('[data-action="capture"]')).not.toBeNull();
    unmount(root, container);
  });

  it("重新拍摄：清空预览回到拍照态", async () => {
    const watermarkFn = vi.fn().mockResolvedValue({
      blob: null,
      dataUrl: "data:image/jpeg;base64,CCCC",
      sha256: "ef".repeat(32),
      watermarkApplied: true,
      width: 640,
      height: 480,
      lines: ["[时间] 2026-08-16 09:08:07", "[坐标] 31.23040°N 121.47370°E", "[订单] wm-a1b2c3d4e5f6"],
    });
    const { container, root } = mount(<ProofCamera orderNo="order-1" watermarkFn={watermarkFn} />);
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    Object.defineProperty(input, "files", { value: [new File(["proof"], "p.jpg")] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => {});
    expect(container.querySelector('[data-testid="proof-camera"]')!.getAttribute("data-phase")).toBe("preview");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-action="retake"]')!.click();
    });
    expect(container.querySelector('[data-testid="proof-camera"]')!.getAttribute("data-phase")).toBe("idle");
    expect(container.querySelector('[data-testid="proof-thumb"]')).toBeNull();
    unmount(root, container);
  });

  it("水印引擎异常（mock reject）：错误提示展示且回拍照态，不崩溃", async () => {
    const watermarkFn = vi.fn().mockRejectedValue(new Error("canvas OOM"));
    const { container, root } = mount(<ProofCamera orderNo="order-1" watermarkFn={watermarkFn} />);
    const input = container.querySelector<HTMLInputElement>('[data-testid="proof-input"]')!;
    Object.defineProperty(input, "files", { value: [new File(["proof"], "p.jpg")] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => {});
    expect(container.querySelector('[data-testid="proof-error"]')).not.toBeNull();
    expect(container.textContent).toContain("canvas OOM");
    expect(container.querySelector('[data-testid="proof-camera"]')!.getAttribute("data-phase")).toBe("idle");
    unmount(root, container);
  });
});

describe("useEdgeSwipeBack 屏幕左边缘手势返回 Hook（集成）", () => {
  it("左边缘右滑 ≥60px：触发 onSwipeBack，且 touchmove/touchend 已 preventDefault", async () => {
    const onSwipeBack = vi.fn();
    function Probe() {
      useEdgeSwipeBack({ onSwipeBack });
      return null;
    }
    const { container, root } = mount(<Probe />);
    const startEvt = fireTouch("touchstart", [{ clientX: 0, clientY: 300 }]);
    const moveEvt = fireTouch("touchmove", [{ clientX: 40, clientY: 300 }]);
    const endEvt = fireTouch("touchend", [{ clientX: 0 + EDGE_SWIPE_THRESHOLD_PX + 40, clientY: 300 }]);
    expect(moveEvt.defaultPrevented).toBe(true);
    expect(endEvt.defaultPrevented).toBe(true);
    expect(startEvt.defaultPrevented).toBe(false);
    expect(onSwipeBack).toHaveBeenCalledTimes(1);
    unmount(root, container);
  });

  it("起点不在左边缘（x=100）：不触发", async () => {
    const onSwipeBack = vi.fn();
    function Probe() {
      useEdgeSwipeBack({ onSwipeBack });
      return null;
    }
    const { container, root } = mount(<Probe />);
    fireTouch("touchstart", [{ clientX: 100, clientY: 300 }]);
    fireTouch("touchend", [{ clientX: 220, clientY: 310 }]);
    expect(onSwipeBack).not.toHaveBeenCalled();
    unmount(root, container);
  });

  it("垂直主导滑动：不触发（忽略纵向滚动）", async () => {
    const onSwipeBack = vi.fn();
    function Probe() {
      useEdgeSwipeBack({ onSwipeBack });
      return null;
    }
    const { container, root } = mount(<Probe />);
    fireTouch("touchstart", [{ clientX: 0, clientY: 300 }]);
    fireTouch("touchmove", [{ clientX: 60, clientY: 420 }]);
    fireTouch("touchend", [{ clientX: 60, clientY: 460 }]);
    expect(onSwipeBack).not.toHaveBeenCalled();
    unmount(root, container);
  });

  it("滑动距离不足（< 60px）：不触发", async () => {
    const onSwipeBack = vi.fn();
    function Probe() {
      useEdgeSwipeBack({ onSwipeBack });
      return null;
    }
    const { container, root } = mount(<Probe />);
    fireTouch("touchstart", [{ clientX: 0, clientY: 300 }]);
    fireTouch("touchend", [{ clientX: 30, clientY: 305 }]);
    expect(onSwipeBack).not.toHaveBeenCalled();
    unmount(root, container);
  });

  it("enabled=false：开关关闭不监听（全屏弹窗禁用场景）", async () => {
    const onSwipeBack = vi.fn();
    function Probe() {
      useEdgeSwipeBack({ onSwipeBack, enabled: false });
      return null;
    }
    const { container, root } = mount(<Probe />);
    fireTouch("touchstart", [{ clientX: 0, clientY: 300 }]);
    fireTouch("touchend", [{ clientX: 200, clientY: 310 }]);
    expect(onSwipeBack).not.toHaveBeenCalled();
    unmount(root, container);
  });

  it("无 onSwipeBack 回调：回退 window.history.back()", async () => {
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    function Probe() {
      useEdgeSwipeBack({});
      return null;
    }
    const { container, root } = mount(<Probe />);
    fireTouch("touchstart", [{ clientX: 10, clientY: 300 }]);
    fireTouch("touchend", [{ clientX: 10 + EDGE_SWIPE_THRESHOLD_PX + 20, clientY: 310 }]);
    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
    unmount(root, container);
  });
});
