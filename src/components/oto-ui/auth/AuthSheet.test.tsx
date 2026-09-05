// @vitest-environment jsdom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase-browser", () => ({
  getBrowserSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  }),
}));

import AuthSheet, {
  AUTH_CHANGED_EVENT,
  AUTH_OPEN_EVENT,
  clearAuthAccount,
  mapOtoRoleToServer,
  mapServerRoleToOto,
  maskPhoneDisplay,
  openAuthSheet,
  readAuthAccount,
} from "@/components/oto-ui/auth/AuthSheet";

const SESSION_DEMANDER = {
  user: {
    id: "u-test-demander",
    email: "13000000002@sms.local",
    user_metadata: { name: "用户_0002", phone: "13000000002", role: "demander" },
  },
};

function mockFetchOnce(handler: (url: string, init?: RequestInit) => unknown) {
  (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
    async (url: unknown, init?: RequestInit) => ({
      ok: true,
      json: async () => handler(String(url), init),
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockGetSession.mockReset();
  mockSignOut.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockSignOut.mockResolvedValue({ error: null });
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

async function open(container: HTMLDivElement) {
  await act(async () => {
    window.dispatchEvent(new Event(AUTH_OPEN_EVENT));
  });
  return container.querySelector<HTMLElement>('[data-testid="auth-sheet"]')!;
}

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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("AuthSheet 真实短信单通道（Phase 2.2）", () => {
  it("未呼出：零渲染（不给前台任何侵入）", () => {
    const { container, root } = mount(<AuthSheet />);
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull();
    unmount(root, container);
  });

  it("呼出：仅手机号单通道，无 demo/钱包 Tab", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = await open(container);
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain("登录 OTO 空间");
    expect(sheet.querySelector('[data-testid="tab-phone"]')).not.toBeNull();
    expect(sheet.querySelector('[data-action="tab-demo"]')).toBeNull();
    expect(sheet.querySelector('[data-action="tab-wallet"]')).toBeNull();
    unmount(root, container);
  });

  it("非法号码禁发；合法号 send 成功出现验证码框与倒计时", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = await open(container);

    const phoneInput = sheet.querySelector<HTMLInputElement>('[data-testid="phone-input"]')!;
    setInput(phoneInput, "123");
    expect(sheet.querySelector<HTMLButtonElement>('[data-action="send-sms"]')!.disabled).toBe(true);

    setInput(phoneInput, "13000000002");
    expect(sheet.querySelector<HTMLButtonElement>('[data-action="send-sms"]')!.disabled).toBe(false);

    mockFetchOnce(() => ({ success: true, message: "验证码已发送" }));
    await act(async () => {
      sheet.querySelector<HTMLButtonElement>('[data-action="send-sms"]')!.click();
    });
    expect(sheet.querySelector('[data-testid="sms-input"]')).not.toBeNull();
    expect(sheet.querySelector('[data-action="send-sms"]')!.textContent).toContain("后重发");
    unmount(root, container);
  });

  it("verify 成功：Session 投影建立（demander→employer）并收起", async () => {
    const onChanged = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, onChanged);
    const { container, root } = mount(<AuthSheet />);
    const sheet = await open(container);

    setInput(sheet.querySelector<HTMLInputElement>('[data-testid="phone-input"]')!, "13000000002");
    mockFetchOnce(() => ({ success: true }));
    await act(async () => {
      sheet.querySelector<HTMLButtonElement>('[data-action="send-sms"]')!.click();
    });
    setInput(sheet.querySelector<HTMLInputElement>('[data-testid="sms-input"]')!, "888888");

    mockGetSession.mockResolvedValue({ data: { session: SESSION_DEMANDER } });
    mockFetchOnce(() => ({ success: true }));
    mockFetchOnce(() => ({ user: { role: "demander", phone: "130****0002", name: "用户_0002" } }));
    await act(async () => {
      sheet.querySelector<HTMLButtonElement>('[data-action="phone-login"]')!.click();
    });

    const account = readAuthAccount();
    expect(account).not.toBeNull();
    expect(account!.method).toBe("session");
    expect(account!.role).toBe("employer");
    expect(account!.uid).toBe("u-test-demander");
    expect(onChanged).toHaveBeenCalled();

    await act(async () => {
      await wait(260);
    });
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull();
    window.removeEventListener(AUTH_CHANGED_EVENT, onChanged);
    unmount(root, container);
  });

  it("verify 失败：显错且不建投影不收起", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = await open(container);

    setInput(sheet.querySelector<HTMLInputElement>('[data-testid="phone-input"]')!, "13000000002");
    mockFetchOnce(() => ({ success: true }));
    await act(async () => {
      sheet.querySelector<HTMLButtonElement>('[data-action="send-sms"]')!.click();
    });
    setInput(sheet.querySelector<HTMLInputElement>('[data-testid="sms-input"]')!, "000000");

    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: "验证码错误" }),
    }));
    await act(async () => {
      sheet.querySelector<HTMLButtonElement>('[data-action="phone-login"]')!.click();
    });
    expect(sheet.querySelector('[data-testid="auth-error"]')).not.toBeNull();
    expect(readAuthAccount()).toBeNull();
    expect(container.querySelector('[data-testid="auth-sheet"]')).not.toBeNull();
    unmount(root, container);
  });

  it("已登录态：呼出显示账号卡；退出登录走 signOut 并广播", async () => {
    const onChanged = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, onChanged);
    mockGetSession.mockResolvedValue({ data: { session: SESSION_DEMANDER } });
    mockFetchOnce(() => ({ user: { role: "demander", phone: "130****0002", name: "用户_0002" } }));

    const { container, root } = mount(<AuthSheet />);
    const sheet = await open(container);
    expect(sheet.querySelector('[data-testid="signed-in"]')).not.toBeNull();
    expect(sheet.textContent).toContain("用户_0002");

    await act(async () => {
      sheet.querySelector<HTMLButtonElement>('[data-action="logout"]')!.click();
    });
    expect(mockSignOut).toHaveBeenCalled();
    expect(readAuthAccount()).toBeNull();
    expect(onChanged).toHaveBeenCalled();
    window.removeEventListener(AUTH_CHANGED_EVENT, onChanged);
    unmount(root, container);
  });

  it("openAuthSheet 导出等价于派发 oto:auth-open", () => {
    const onOpen = vi.fn();
    window.addEventListener(AUTH_OPEN_EVENT, onOpen);
    openAuthSheet();
    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_OPEN_EVENT, onOpen);
  });

  it("遮罩点击：收起抽屉", async () => {
    const { container, root } = mount(<AuthSheet />);
    const sheet = await open(container);
    await act(async () => {
      sheet.querySelector<HTMLElement>('[data-action="mask"]')!.click();
    });
    expect(sheet.querySelector(".auth-sheet")!.className).toContain("auth-sheet-dismissing");
    await act(async () => {
      await wait(260);
    });
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull();
    unmount(root, container);
  });

  it("clearAuthAccount：走 signOut 并清空投影", async () => {
    await clearAuthAccount();
    expect(mockSignOut).toHaveBeenCalled();
    expect(readAuthAccount()).toBeNull();
  });
});

describe("角色映射（核准标准）", () => {
  it("服务端→OTO：demander 归雇主，provider/both 归服务者，未知兜底雇主", () => {
    expect(mapServerRoleToOto("demander")).toBe("employer");
    expect(mapServerRoleToOto("provider")).toBe("provider");
    expect(mapServerRoleToOto("both")).toBe("provider");
    expect(mapServerRoleToOto("admin")).toBe("employer");
    expect(mapServerRoleToOto("user")).toBe("employer");
    expect(mapServerRoleToOto(null)).toBe("employer");
    expect(mapServerRoleToOto("CUSTOMER")).toBe("employer");
  });

  it("OTO→服务端：仅输出 CHECK 合法值", () => {
    expect(mapOtoRoleToServer("employer")).toBe("demander");
    expect(mapOtoRoleToServer("provider")).toBe("provider");
    expect(mapOtoRoleToServer("host")).toBe("provider");
  });

  it("手机号脱敏展示", () => {
    expect(maskPhoneDisplay("13000000002")).toBe("130****0002");
  });
});
