import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StatusCapsule, {
  STATUS_CAPSULE_EMOJI,
  STATUS_CAPSULE_META,
} from "@/components/oto-ui/StatusCapsule";

/** 五态标签渲染断言（status → 期望标签）。 */
const LABEL_BY_STATE: Record<
  "PUBLISHED" | "MATCHED" | "IN_SERVICE" | "INSPECTED" | "SETTLED",
  string
> = {
  PUBLISHED: "寻找服务者中...",
  MATCHED: "服务者已就位",
  IN_SERVICE: "履约保护中 · GPS锁定",
  INSPECTED: "待验收与对账",
  SETTLED: "订单已圆满结算",
};

describe("StatusCapsule 五态灵动胶囊", () => {
  for (const [state, label] of Object.entries(LABEL_BY_STATE) as [
    keyof typeof LABEL_BY_STATE,
    string,
  ][]) {
    it(`渲染 ${state} 态标签与视觉元数据`, () => {
      const html = renderToStaticMarkup(<StatusCapsule status={state} />);
      expect(html).toContain(label);
      expect(html).toContain(`data-status="${state}"`);
      expect(html).toContain(`data-tone="${STATUS_CAPSULE_META[state].tone}"`);
      expect(html).toContain(STATUS_CAPSULE_EMOJI[state]);
      expect(html).toContain(`background-color:${STATUS_CAPSULE_META[state].dotColor}`);
      expect(html).toContain("status-capsule-dot");
      expect(html).toContain("status-pulse");
    });
  }

  it("常驻显性红色 SOS 按钮（aria-label + SOS 文案）", () => {
    const html = renderToStaticMarkup(<StatusCapsule status="IN_SERVICE" />);
    expect(html).toContain('aria-label="SOS 紧急求助"');
    expect(html).toContain(">SOS</button>");
    expect(html).toContain("status-capsule-sos");
  });

  it("弱网离线时展示 📴 离线告警徽标，在线时不展示", () => {
    const offline = renderToStaticMarkup(
      <StatusCapsule status="PUBLISHED" options={{ isOffline: true }} />,
    );
    expect(offline).toContain("📴 离线");
    expect(offline).toContain("status-capsule-offline");

    const online = renderToStaticMarkup(<StatusCapsule status="PUBLISHED" />);
    expect(online).not.toContain("离线");
  });

  it("LBS 距离指示：提供 distanceMeters 时展示距服务者距离", () => {
    const html = renderToStaticMarkup(
      <StatusCapsule status="IN_SERVICE" options={{ distanceMeters: 500 }} />,
    );
    expect(html).toContain("距服务者 500m");

    const noDistance = renderToStaticMarkup(<StatusCapsule status="IN_SERVICE" />);
    expect(noDistance).not.toContain("距服务者");
  });

  it("SOS 按钮与离线徽标可同时挂载（外骨骼锚点完整性）", () => {
    const html = renderToStaticMarkup(
      <StatusCapsule
        status="MATCHED"
        options={{ isOffline: true, distanceMeters: 120 }}
      />,
    );
    expect(html).toContain("📴 离线");
    expect(html).toContain("距服务者 120m");
    expect(html).toContain('aria-label="SOS 紧急求助"');
    expect(html).toContain("服务者已就位");
  });
});
