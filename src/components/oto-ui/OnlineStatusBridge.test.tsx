// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import OnlineStatusBridge from "@/components/oto-ui/OnlineStatusBridge";

/**
 * W6 接线连线测试：layout 级离线桥
 * - 初始在线：无任何提示；
 * - 断网（window offline 事件）→ 琥珀提示条（离线队列暂存笔数）；
 * - 联网（window online 事件）→ 绿色追回 Toast 自动出现。
 */
describe("W6 接线：OnlineStatusBridge 全局离线桥", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function render() {
    await act(async () => {
      root.render(<OnlineStatusBridge />);
    });
  }

  it("初始在线：不渲染任何提示条", async () => {
    await render();
    expect(container.textContent).not.toContain("离线");
    expect(container.textContent).not.toContain("网络已恢复");
    root.unmount();
    container.remove();
  });

  it("断网（offline 事件）→ 琥珀提示条出现并展示队列暂存笔数", async () => {
    await render();
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(container.querySelector('[data-state="offline"]')).not.toBeNull();
    expect(container.textContent).toContain("离线模式");
    expect(container.textContent).toContain("本地加密队列");
    root.unmount();
    container.remove();
  });

  it("联网（online 事件）→ 恢复 Toast「网络已恢复」自动播报", async () => {
    await render();
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(container.querySelector('[data-state="offline"]')).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(container.querySelector('[data-state="recovered"]')).not.toBeNull();
    expect(container.textContent).toContain("✅ 网络已恢复");
    expect(container.textContent).not.toContain("离线模式");
    root.unmount();
    container.remove();
  });

  it("重复断网 → 重新显示离线提示条（状态可逆；离线瞬间优先于追回 Toast）", async () => {
    await render();
    // 独立事件循环（浏览器 real-task 语义）：离线 → 恢复
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(container.querySelector('[data-state="recovered"]')).not.toBeNull();
    // Toast 播放期间再次断网：离线提示条优先，追回 Toast 让位
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(container.querySelector('[data-state="offline"]')).not.toBeNull();
    expect(container.querySelector('[data-state="recovered"]')).toBeNull();
    root.unmount();
    container.remove();
  });
});
