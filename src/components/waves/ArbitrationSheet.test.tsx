// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ArbitrationSheet, {
  resolveArbitrationLevel,
  type ArbitrationEvidence,
  type ArbitrationProposal,
  type ArbitrationSheetProps,
} from "./ArbitrationSheet";

const EVIDENCE: ArbitrationEvidence = {
  complaint: "保洁完成后发现柜子背面未清洁，要求退款",
  providerStatement: "已按清单完成，柜子背面属于合同外区域",
  chatTranscript: ["客户：后面没擦到", "师傅：背面不在清单内"],
};

const PROPOSAL: ArbitrationProposal = {
  liability: "split",
  liabilityNote: "双方按比担责：保洁遗漏一处 + 合同范围争议",
  refundAmount: 40,
  compensationCouponYuan: 10,
  creditDeduct: 5,
  reasonChain: ["证据照片显示背面未清洁", "合同清单未包含柜子背面"],
};

const BASE_PROPS: ArbitrationSheetProps = {
  open: true,
  orderId: "arb-1",
  evidence: EVIDENCE,
  proposal: PROPOSAL,
  onAcceptProposal: () => {},
  onEscalateManual: () => {},
  onClose: () => {},
};

function renderStatic(props: Partial<ArbitrationSheetProps>): string {
  return renderToStaticMarkup(
    <ArbitrationSheet {...BASE_PROPS} {...props} />,
  );
}

/** jsdom 挂载渲染并触发 data-action 按钮点击，返回回调调用记录。 */
async function clickAction(
  props: Partial<ArbitrationSheetProps>,
  action: string,
): Promise<string[]> {
  const calls: string[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ArbitrationSheet
        {...BASE_PROPS}
        {...props}
        onInstantCompensate={() => calls.push("instant-compensate")}
        onConnectLegal={() => calls.push("connect-legal")}
        onAcceptProposal={() => calls.push("accept-proposal")}
        onEscalateManual={() => calls.push("escalate-manual")}
      />,
    );
  });
  const btn = container.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  if (btn) {
    await act(async () => {
      btn.click();
    });
  }
  root.unmount();
  document.body.removeChild(container);
  return calls;
}

/* ============ 1. 三级分流判定纯函数 ============ */

describe("resolveArbitrationLevel 三级分流判定", () => {
  it("金额 25 元且无安全告警 → LEVEL_1（小额秒赔）", () => {
    expect(resolveArbitrationLevel(25, false)).toBe("LEVEL_1");
  });

  it("金额恰好 30 元 → LEVEL_1（边界含等号）", () => {
    expect(resolveArbitrationLevel(30, false)).toBe("LEVEL_1");
  });

  it("金额 200 元 → LEVEL_2（AI+人工双轨）", () => {
    expect(resolveArbitrationLevel(200, false)).toBe("LEVEL_2");
  });

  it("金额恰好 500 元 → LEVEL_2（上边界含等号）", () => {
    expect(resolveArbitrationLevel(500, false)).toBe("LEVEL_2");
  });

  it("金额 800 元 → LEVEL_3（法务直通）", () => {
    expect(resolveArbitrationLevel(800, false)).toBe("LEVEL_3");
  });

  it("任意金额触发红色报警 → LEVEL_3（人身安全优先）", () => {
    expect(resolveArbitrationLevel(10, true)).toBe("LEVEL_3");
    expect(resolveArbitrationLevel(0, true)).toBe("LEVEL_3");
  });

  it("金额缺省 → 保守 LEVEL_2（既有行为兼容）", () => {
    expect(resolveArbitrationLevel(undefined, false)).toBe("LEVEL_2");
  });

  it("非法金额（NaN / 负数 / 0）→ LEVEL_2 保守兜底", () => {
    expect(resolveArbitrationLevel(NaN, false)).toBe("LEVEL_2");
    expect(resolveArbitrationLevel(-5, false)).toBe("LEVEL_2");
    expect(resolveArbitrationLevel(0, false)).toBe("LEVEL_2");
  });
});

/* ============ 2. Level 1 渲染（25 元） ============ */

describe("Level 1 · 小额秒赔卡", () => {
  it("金额 25 元 → 渲染 🟢 Level 1 秒赔卡 + 一键秒赔按钮，无 AI 建议卡", () => {
    const html = renderStatic({ disputeAmountYuan: 25 });
    expect(html).toContain("data-level=\"LEVEL_1\"");
    expect(html).toContain("🟢 Level 1 极小额争议");
    expect(html).toContain("data-testid=\"instant-compensate-card\"");
    expect(html).toContain("一键秒级补偿");
    expect(html).not.toContain("data-testid=\"ai-proposal-card\"");
    expect(html).not.toContain("data-action=\"accept-proposal\"");
  });

  it("秒赔按钮 → 触发 onInstantCompensate 回调", async () => {
    const calls = await clickAction(
      { disputeAmountYuan: 25 },
      "instant-compensate",
    );
    expect(calls).toEqual(["instant-compensate"]);
  });

  it("L1 秒赔卡标注平台体验保障金与零扣罚", () => {
    const html = renderStatic({ disputeAmountYuan: 25 });
    expect(html).toContain("平台体验保障金");
    expect(html).toContain("零扣罚");
  });
});

/* ============ 3. Level 2 渲染（200 元） ============ */

describe("Level 2 · AI + 人工双轨", () => {
  it("金额 200 元 → 渲染 🟡 Level 2 + AI 建议卡 + 双出口", () => {
    const html = renderStatic({ disputeAmountYuan: 200 });
    expect(html).toContain("data-level=\"LEVEL_2\"");
    expect(html).toContain("🟡 Level 2 双轨");
    expect(html).toContain("data-testid=\"ai-proposal-card\"");
    expect(html).toContain("data-testid=\"proposal-refund\"");
    expect(html).toContain("data-action=\"accept-proposal\"");
    expect(html).toContain("data-action=\"escalate-manual\"");
    expect(html).not.toContain("data-testid=\"instant-compensate-card\"");
    expect(html).not.toContain("data-testid=\"legal-direct-card\"");
  });

  it("接受方案 / 人工客服按钮均可用", async () => {
    expect(await clickAction({ disputeAmountYuan: 200 }, "accept-proposal")).toEqual([
      "accept-proposal",
    ]);
    expect(await clickAction({ disputeAmountYuan: 200 }, "escalate-manual")).toEqual([
      "escalate-manual",
    ]);
  });

  it("金额缺省 → 保持 Level 2 既有渲染（兼容原行为）", () => {
    const html = renderStatic({});
    expect(html).toContain("data-level=\"LEVEL_2\"");
    expect(html).toContain("data-testid=\"ai-proposal-card\"");
    expect(html).toContain("data-action=\"accept-proposal\"");
  });
});

/* ============ 4. Level 3 渲染（800 元 / 红色报警） ============ */

describe("Level 3 · 法务专家直连", () => {
  it("金额 800 元 → 渲染 🔴 Level 3 法务卡 + 直连按钮，切断线上调解", () => {
    const html = renderStatic({ disputeAmountYuan: 800 });
    expect(html).toContain("data-level=\"LEVEL_3\"");
    expect(html).toContain("🔴 Level 3 重大争议/人身安全警报");
    expect(html).toContain("data-testid=\"legal-direct-card\"");
    expect(html).toContain("data-testid=\"legal-connect-card\"");
    expect(html).toContain("data-testid=\"legal-insurance-card\"");
    expect(html).toContain("紧急连线安全法务组");
    expect(html).toContain("联动保险公司现场勘查");
    expect(html).not.toContain("data-testid=\"ai-proposal-card\"");
    expect(html).not.toContain("data-action=\"accept-proposal\"");
    expect(html).not.toContain("data-action=\"instant-compensate\"");
  });

  it("红色报警（小额 10 元）→ 强制 LEVEL_3 法务直通", () => {
    const html = renderStatic({ disputeAmountYuan: 10, hasSafetyAlert: true });
    expect(html).toContain("data-level=\"LEVEL_3\"");
    expect(html).toContain("人身安全红色告警");
    expect(html).toContain("data-testid=\"legal-direct-card\"");
    expect(html).not.toContain("data-action=\"instant-compensate\"");
  });

  it("法务直连按钮 → 触发 onConnectLegal 回调", async () => {
    const calls = await clickAction(
      { disputeAmountYuan: 800 },
      "connect-legal",
    );
    expect(calls).toEqual(["connect-legal"]);
  });
});

/* ============ 5. 基础兼容（既有断言面） ============ */

describe("基础渲染兼容（W7 既有面）", () => {
  it("证据链 / AI 卡 / 导出按钮照常渲染（Level 2 形态）", () => {
    const html = renderStatic({ disputeAmountYuan: 200 });
    expect(html).toContain("data-testid=\"evidence-chain\"");
    expect(html).toContain("data-testid=\"evidence-complaint\"");
    expect(html).toContain("data-action=\"export-judicial\"");
    expect(html).toContain("争议调解");
  });

  it("抽屉关闭（open=false）→ 不渲染", () => {
    const html = renderStatic({ open: false });
    expect(html).toBe("");
  });
});

/* ============ 6. L3-M4 AIGC 鉴真徽标展示 ============ */

describe("AIGC 鉴真评分徽标（L3-M4 物证链）", () => {
  it("照片带鉴真报告 → 展示置信度百分比 + 风险等级徽标", () => {
    const html = renderStatic({
      disputeAmountYuan: 200,
      evidence: {
        complaint: "完工照片疑似 AI 生成，要求核验",
        photos: [
          {
            photo: "/cap-1.jpg",
            aiNote: "水印存证 · 哈希 0a1b2c3d",
            forgeryReport: {
              riskLevel: "CRITICAL",
              overallConfidence: 0.23,
              tamperFlags: ["EXIF_MISSING", "HASH_TAMPERED"],
            },
          },
        ],
      },
    });
    expect(html).toContain('data-testid="photo-forgery"');
    expect(html).toContain('data-testid="forgery-risk"');
    expect(html).toContain("AIGC 鉴真 23%");
    expect(html).toContain("CRITICAL 伪造");
    expect(html).toContain("EXIF_MISSING");
    expect(html).toContain("HASH_TAMPERED");
  });

  it("可信照片（LOW）→ 绿色徽标 + 无疑点标签", () => {
    const html = renderStatic({
      disputeAmountYuan: 200,
      evidence: {
        complaint: "无争议",
        photos: [
          {
            photo: "/cap-2.jpg",
            aiNote: "水印存证",
            forgeryReport: { riskLevel: "LOW", overallConfidence: 0.96, tamperFlags: [] },
          },
        ],
      },
    });
    expect(html).toContain("AIGC 鉴真 96%");
    expect(html).toContain("LOW 可信");
    expect(html).not.toContain("疑点标签：");
  });

  it("照片无鉴真报告 → 不渲染徽标（向后兼容）", () => {
    const html = renderStatic({ disputeAmountYuan: 200 });
    expect(html).not.toContain('data-testid="photo-forgery"');
  });
});
