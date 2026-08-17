// @vitest-environment jsdom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthSheet, {
  AUTH_ACCOUNT_KEY,
  AUTH_CHANGED_EVENT,
  AUTH_OPEN_EVENT,
  clearAuthAccount,
  DEMO_SMS_CODE,
  openAuthSheet,
  readAuthAccount,
  type AuthAccount,
} from "@/components/oto-ui/auth/AuthSheet";

beforeEach(() => {
  window.localStorage.clear();
});

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

function open(container: HTMLDivElement) {
  act(() => {
    window.dispatchEvent(new Event(AUTH_OPEN_EVENT));
  });
  return container.querySelector<HTMLElement>('[data-testid="auth-sheet"]')!;
}

function fireTouch(
  type: "touchstart" | "touchmove" | "touchend",
  points: { clientX: number; clientY: number }[],
  target: EventTarget,
) {
  const ev = new Event(type, { cancelable: true }) as unknown as TouchEvent;
  Object.defineProperty(ev, "touches", { value: points });
  Object.defineProperty(ev, "changedTouches", { value: points });
  target.dispatchEvent(ev);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const innerSheet = (sheet: HTMLElement) => sheet.querySelector<HTMLElement>(".auth-sheet")!;

describe("AuthSheet 空间毛玻璃登录抽屉（方案 A）", () => {
  it("未呼出：零渲染（不给前台任何侵入）", () => {
    const { container, root } = mount(<AuthSheet />);
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull();
    unmount(root, container);
  });

  it("oto:auth-open 呼出：抽屉 + 三通道 Tab 齐全，标题为登录态", () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain("登录 OTO 空间");
    expect(sheet.querySelector('[data-action="tab-phone"]')).not.toBeNull();
    expect(sheet.querySelector('[data-action="tab-demo"]')).not.toBeNull();
    expect(sheet.querySelector('[data-action="tab-wallet"]')).not.toBeNull();
    expect(sheet.querySelector('[data-action="drag-grip"]')).not.toBeNull();
    unmount(root, container);
  });

  it("手机号通道：非法号码禁发验证码，合法号码发码→固定演示码 1234 登录成功并收起", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);

    const phoneInput = sheet.querySelector<HTMLInputElement>('[data-testid="phone-input"]')!;
    setInput(phoneInput, "123");
    expect(sheet.querySelector<HTMLButtonElement>('[data-action="send-sms"]')!.disabled).toBe(true);

    setInput(phoneInput, "13800138000");
    expect(sheet.querySelector<HTMLButtonElement>('[data-action="send-sms"]')!.disabled).toBe(false);
    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="send-sms"]')!.click();
    });
    const smsInput = sheet.querySelector<HTMLInputElement>('[data-testid="sms-input"]')!;
    expect(smsInput).not.toBeNull();

    // 错误验证码：登录禁用
    setInput(smsInput, "0000");
    expect(sheet.querySelector<HTMLButtonElement>('[data-action="phone-login"]')!.disabled).toBe(true);

    setInput(smsInput, DEMO_SMS_CODE);
    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="phone-login"]')!.click();
    });

    const account = readAuthAccount();
    expect(account).not.toBeNull();
    expect(account!.method).toBe("phone");
    expect(account!.role).toBe("employer");

    await act(async () => {
      await wait(260);
    });
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull();
    unmount(root, container);
  });

  it("演示账号：一键登录三角色之一，本地持久化 + oto:auth-changed 广播", () => {
    const onChanged = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, onChanged);

    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);
    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="tab-demo"]')!.click();
    });
    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="demo-provider"]')!.click();
    });

    const account = readAuthAccount();
    expect(account).not.toBeNull();
    expect(account!.role).toBe("provider");
    expect(account!.method).toBe("demo");
    expect(window.localStorage.getItem(AUTH_ACCOUNT_KEY)).not.toBeNull();
    expect(onChanged).toHaveBeenCalled();

    window.removeEventListener(AUTH_CHANGED_EVENT, onChanged);
    unmount(root, container);
  });

  it("Web3 钱包：连接（模拟 700ms）→ 展示脱敏地址 → 钱包登录", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);
    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="tab-wallet"]')!.click();
    });
    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="connect-wallet"]')!.click();
    });
    await act(async () => {
      await wait(760);
    });
    expect(sheet.querySelector('[data-testid="wallet-addr"]')).not.toBeNull();

    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="wallet-login"]')!.click();
    });
    const account = readAuthAccount();
    expect(account).not.toBeNull();
    expect(account!.method).toBe("wallet");
    unmount(root, container);
  });

  it("下拉手势：位移 36% 触发平滑收起（220ms 后离场）", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);
    const grip = sheet.querySelector<HTMLElement>('[data-action="drag-grip"]')!;
    Object.defineProperty(grip, "clientHeight", { value: 500, configurable: true });

    act(() => {
      fireTouch("touchstart", [{ clientX: 200, clientY: 100 }], grip);
      fireTouch("touchmove", [{ clientX: 200, clientY: 260 }], grip);
      fireTouch("touchend", [{ clientX: 200, clientY: 280 }], grip);
    });
    expect(innerSheet(sheet).className).toContain("auth-sheet-dismissing");

    await act(async () => {
      await wait(260);
    });
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull();
    unmount(root, container);
  });

  it("下拉手势：位移 30% 触发复位，不收起", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);
    const grip = sheet.querySelector<HTMLElement>('[data-action="drag-grip"]')!;
    Object.defineProperty(grip, "clientHeight", { value: 500, configurable: true });

    fireTouch("touchstart", [{ clientX: 200, clientY: 100 }], grip);
    fireTouch("touchend", [{ clientX: 200, clientY: 250 }], grip);
    expect(innerSheet(sheet).className).not.toContain("auth-sheet-dismissing");
    unmount(root, container);
  });

  it("遮罩点击：收起抽屉", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);
    act(() => {
      sheet.querySelector<HTMLElement>('[data-action="mask"]')!.click();
    });
    expect(innerSheet(sheet).className).toContain("auth-sheet-dismissing");
    await act(async () => {
      await wait(260);
    });
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull();
    unmount(root, container);
  });

  it("已登录态：呼出显示账号卡；退出登录清空并广播；再呼出回登录表单", () => {
    const onChanged = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, onChanged);
    const seeded: AuthAccount = { nickname: "雇主 Alex", emoji: "🧑‍💼", role: "employer", method: "demo", at: 1 };
    window.localStorage.setItem(AUTH_ACCOUNT_KEY, JSON.stringify(seeded));

    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);
    expect(sheet.querySelector('[data-testid="signed-in"]')).not.toBeNull();
    expect(sheet.textContent).toContain("切换 / 退出账号");

    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="logout"]')!.click();
    });
    expect(window.localStorage.getItem(AUTH_ACCOUNT_KEY)).toBeNull();
    expect(onChanged).toHaveBeenCalled();
    expect(readAuthAccount()).toBeNull();

    unmount(root, container);
  });

  it("切换账号：已登录态点切换 → 回到一键演示表单（不残留已登录卡）", () => {
    const seeded: AuthAccount = { nickname: "雇主 Alex", emoji: "🧑‍💼", role: "employer", method: "demo", at: 1 };
    window.localStorage.setItem(AUTH_ACCOUNT_KEY, JSON.stringify(seeded));

    const { container, root } = mount(<AuthSheet />);
    const sheet = open(container);
    expect(sheet.querySelector('[data-testid="signed-in"]')).not.toBeNull();
    act(() => {
      sheet.querySelector<HTMLButtonElement>('[data-action="switch-account"]')!.click();
    });
    expect(sheet.querySelector('[data-testid="signed-in"]')).toBeNull();
    expect(sheet.querySelector('[data-action="demo-provider"]')).not.toBeNull();
    unmount(root, container);
  });

  it("openAuthSheet 导出等价于派发 oto:auth-open", () => {
    const onOpen = vi.fn();
    window.addEventListener(AUTH_OPEN_EVENT, onOpen);
    openAuthSheet();
    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_OPEN_EVENT, onOpen);
  });

  it("clearAuthAccount：幂等清空（无账号时静默）", () => {
    clearAuthAccount();
    expect(readAuthAccount()).toBeNull();
  });
});