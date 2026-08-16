// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import type { Claim, Wave } from "@/base/order/wave";
import { createWave, type CreateWaveInput } from "@/base/order/wave";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import ArbitrationSheet, {
  type ArbitrationEvidence,
  type ArbitrationProposal,
} from "./ArbitrationSheet";
import FulfillmentCenter, {
  needsCockpit,
  nextCockpitState,
  resolveCockpitScenario,
  buildDisputeEvidence,
  buildDisputeProposal,
} from "./FulfillmentCenter";
import type { AtomicFiveState } from "@/types/ammo-schema";

/* ================= 测试工厂 ================= */

function makeWaveInput(overrides: Partial<CreateWaveInput> = {}): CreateWaveInput {
  return {
    id: `w-e2e-${Math.random().toString(36).slice(2, 8)}`,
    authorId: useIdentityStore.getState().identity.id,
    basics: { category: "家政保洁", time: "明天 11:00", area: "幸福家园小区", radiusKm: 5 },
    budget: 200,
    expiresAt: Date.now() + 3_600_000,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeWave(
  overrides: Partial<CreateWaveInput> & { status?: Wave["status"] } = {},
): Wave {
  const { status, ...rest } = overrides;
  const wave = createWave(makeWaveInput(rest));
  return status ? { ...wave, status } : wave;
}

function makeAcceptedClaim(waveId: string, responderId = "r-2001"): Claim {
  return {
    id: `c-${Math.random().toString(36).slice(2, 8)}`,
    waveId,
    responderId,
    status: "accepted",
    rounds: 0,
    price: 200,
    createdAt: Date.now(),
  };
}

function resetStores() {
  useWaveStore.setState({
    waves: [],
    claims: [],
    fulfilment: {},
  });
}

const EVIDENCE: ArbitrationEvidence = {
  complaint: "保洁完工后客厅角落仍有积灰，要求部分退款。",
  providerStatement: "已按清单完成全屋保洁。",
  photos: [{ photo: "work-done", aiNote: "检测到局部除尘残留（置信度 0.87）" }],
  chatTranscript: ["雇主 14:02：师傅几点到？", "履约方 14:10：路上堵车"],
};

const PROPOSAL: ArbitrationProposal = {
  liability: "split",
  liabilityNote: "迟到 + 局部不达标由履约方承担",
  refundAmount: 60,
  compensationCouponYuan: 20,
  creditDeduct: 10,
  reasonChain: ["规则 R-1：迟到 >15 分钟 → 履约方担责", "规则 R-2：局部残留按 8% 折算"],
};

/* ================= W7：ArbitrationSheet ================= */

describe("W7 争议调解小法官半屏抽屉（ArbitrationSheet）", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function render(props: Parameters<typeof ArbitrationSheet>[0]) {
    await act(async () => {
      root.render(<ArbitrationSheet {...props} />);
    });
  }

  it("物证比对链三区块：投诉诉求 + 照片 AI 标注 + 聊天记录", async () => {
    await render({
      open: true,
      orderId: "w-1",
      evidence: EVIDENCE,
      proposal: PROPOSAL,
      onAcceptProposal: () => {},
      onEscalateManual: () => {},
      onClose: () => {},
    });
    expect(container.querySelector('[data-testid="arbitration-sheet"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="evidence-complaint"]')?.textContent).toContain(
      "客厅角落仍有积灰",
    );
    expect(container.querySelector('[data-testid="evidence-statement"]')?.textContent).toContain(
      "全屋保洁",
    );
    const photo = container.querySelector('[data-testid="evidence-photo"]');
    expect(photo?.textContent).toContain("除尘残留");
    const chat = container.querySelector('[data-testid="evidence-chat"]');
    expect(chat?.textContent).toContain("路上堵车");
    root.unmount();
    container.remove();
  });

  it("AI 小法官建议卡：退款 / 补偿券 / 责任 / 信用扣减 / 理由链 / Advisory 徽章", async () => {
    await render({
      open: true,
      orderId: "w-1",
      currentState: "INSPECTED",
      evidence: EVIDENCE,
      proposal: PROPOSAL,
      onAcceptProposal: () => {},
      onEscalateManual: () => {},
      onClose: () => {},
    });
    const card = container.querySelector('[data-testid="ai-proposal-card"]');
    expect(card?.textContent).toContain("仅 Advisory");
    expect(container.querySelector('[data-testid="proposal-refund"]')?.textContent).toContain("¥60");
    expect(container.querySelector('[data-testid="proposal-coupon"]')?.textContent).toContain("¥20");
    expect(container.querySelector('[data-testid="proposal-liability"]')?.textContent).toContain(
      "双方按比担责",
    );
    expect(container.querySelector('[data-testid="proposal-credit"]')?.textContent).toContain("-10");
    expect(container.querySelector('[data-testid="proposal-reasons"]')?.textContent).toContain(
      "规则 R-1",
    );
    expect(container.textContent).toContain("INSPECTED");
    root.unmount();
    container.remove();
  });

  it("按钮 A【🤝 接受调解方案】触发 onAcceptProposal（写入由用户确认 · 红线 1）", async () => {
    let accepted = false;
    await render({
      open: true,
      orderId: "w-1",
      evidence: EVIDENCE,
      proposal: PROPOSAL,
      onAcceptProposal: () => {
        accepted = true;
      },
      onEscalateManual: () => {},
      onClose: () => {},
    });
    const btn = container.querySelector('[data-action="accept-proposal"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(accepted).toBe(true);
    root.unmount();
    container.remove();
  });

  it("按钮 B【🧑‍⚖️ 申请人工客服】触发 onEscalateManual（冻结资金入人工队列）", async () => {
    let escalated = false;
    await render({
      open: true,
      orderId: "w-1",
      evidence: EVIDENCE,
      proposal: PROPOSAL,
      onAcceptProposal: () => {},
      onEscalateManual: () => {
        escalated = true;
      },
      onClose: () => {},
    });
    const btn = container.querySelector('[data-action="escalate-manual"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(escalated).toBe(true);
    root.unmount();
    container.remove();
  });

  it("关闭：✕ 按钮与遮罩点击均触发 onClose", async () => {
    let closed = 0;
    await render({
      open: true,
      orderId: "w-1",
      evidence: EVIDENCE,
      proposal: PROPOSAL,
      onAcceptProposal: () => {},
      onEscalateManual: () => {},
      onClose: () => {
        closed += 1;
      },
    });
    (container.querySelector('[data-action="close"]') as HTMLButtonElement).click();
    (container.querySelector('[data-action="mask"]') as HTMLElement).click();
    expect(closed).toBe(2);
    root.unmount();
    container.remove();
  });

  it("open=false 不渲染抽屉", async () => {
    await render({
      open: false,
      orderId: "w-1",
      evidence: EVIDENCE,
      proposal: PROPOSAL,
      onAcceptProposal: () => {},
      onEscalateManual: () => {},
      onClose: () => {},
    });
    expect(container.querySelector('[data-testid="arbitration-sheet"]')).toBeNull();
    root.unmount();
    container.remove();
  });
});

/* ================= W3：FulfillmentCenter ================= */

describe("W3 纯函数矩阵：scenario 解析与座舱挂载判定", () => {
  it("ammoId 优先：housekeeping-v1 / meetup-social-v1 / companion-v1", () => {
    expect(resolveCockpitScenario({ ammoId: "housekeeping-v1", basics: { category: "家政保洁" } })).toBe("housekeeping");
    expect(resolveCockpitScenario({ ammoId: "meetup-social-v1", basics: { category: "羽毛球约局" } })).toBe("meetup");
    expect(resolveCockpitScenario({ ammoId: "companion-v1", basics: { category: "陪玩" } })).toBe("companion");
  });

  it("中文类目兜底（无 ammoId 的存量 Wave）", () => {
    expect(resolveCockpitScenario({ basics: { category: "家政保洁" } })).toBe("housekeeping");
    expect(resolveCockpitScenario({ basics: { category: "组局" } })).toBe("meetup");
    expect(resolveCockpitScenario({ basics: { category: "交友" } })).toBe("companion");
  });

  it("needsCockpit：仅 MATCHED / IN_SERVICE / INSPECTED 挂载", () => {
    for (const s of ["MATCHED", "IN_SERVICE", "INSPECTED"] as AtomicFiveState[]) {
      expect(needsCockpit(s)).toBe(true);
    }
    for (const s of ["PUBLISHED", "SETTLED", null] as (AtomicFiveState | null)[]) {
      expect(needsCockpit(s)).toBe(false);
    }
  });

  it("nextCockpitState 核销链：MATCHED→IN_SERVICE→INSPECTED→SETTLED", () => {
    expect(nextCockpitState("MATCHED")).toBe("IN_SERVICE");
    expect(nextCockpitState("IN_SERVICE")).toBe("INSPECTED");
    expect(nextCockpitState("INSPECTED")).toBe("SETTLED");
  });
});

describe("W3~W5 端到端：FulfillmentCenter 装配与真实 advanceLifecycle 流转", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    resetStores();
  });

  async function renderCenter() {
    await act(async () => {
      root.render(<FulfillmentCenter />);
    });
  }

  it("无进行中单 → 座舱不渲染", async () => {
    await renderCenter();
    expect(container.querySelector('[data-testid="fulfillment-center"]')).toBeNull();
    root.unmount();
    container.remove();
  });

  it("MATCHED 单（claimed + accepted + ammoId=housekeeping-v1）→ 挂载座舱 + 家政插槽 + 顶栏胶囊 🔵", async () => {
    const wave = makeWave({
      id: "w-hk-1",
      status: "claimed" as const,
      ammoId: "housekeeping-v1",
    });
    useWaveStore.setState({ waves: [wave], claims: [makeAcceptedClaim(wave.id)] });
    await renderCenter();

    const center = container.querySelector('[data-testid="fulfillment-center"]');
    expect(center).not.toBeNull();
    expect(center?.getAttribute("data-scenario")).toBe("housekeeping");
    expect(container.querySelector('[data-slot="housekeeping"]')).not.toBeNull();
    expect(container.textContent).toContain("清洁蓝");
    root.unmount();
    container.remove();
  });

  it("核销 CTA 三次点击：MATCHED→IN_SERVICE→INSPECTED→SETTLED（advanceLifecycle 真实引擎 + store 回写）", async () => {
    const wave = makeWave({
      id: "w-hk-2",
      status: "claimed" as const,
      ammoId: "housekeeping-v1",
    });
    useWaveStore.setState({ waves: [wave], claims: [makeAcceptedClaim(wave.id)] });
    await renderCenter();

    // ① MATCHED → IN_SERVICE（开始履约）
    let cta = container.querySelector('[data-action="complete"]') as HTMLButtonElement;
    expect(cta).not.toBeNull();
    await act(async () => {
      cta.click();
    });
    expect(useWaveStore.getState().fulfilment[wave.id]?.fulfilmentStatus).toBe("reported");
    expect(container.textContent).toContain("IN_SERVICE");

    // ② IN_SERVICE → INSPECTED（扫码确认完工）
    cta = container.querySelector('[data-action="complete"]') as HTMLButtonElement;
    await act(async () => {
      cta.click();
    });
    expect(useWaveStore.getState().fulfilment[wave.id]?.fulfilmentStatus).toBe("confirmed");
    expect(container.textContent).toContain("INSPECTED");

    // ③ INSPECTED → SETTLED（确认结算）
    cta = container.querySelector('[data-action="complete"]') as HTMLButtonElement;
    await act(async () => {
      cta.click();
    });
    expect(useWaveStore.getState().fulfilment[wave.id]?.isSettled).toBe(true);
    // SETTLED 后座舱卸载（needsCockpit=false）
    expect(container.querySelector('[data-testid="fulfillment-center"]')).toBeNull();
    root.unmount();
    container.remove();
  });

  it("争议入口 ⚖️ → ArbitrationSheet 呼出 → 接受调解 → BREACH_SETTLED 流转 SETTLED", async () => {
    const wave = makeWave({
      id: "w-hk-3",
      status: "locked" as const,
      ammoId: "housekeeping-v1",
    });
    useWaveStore.setState({ waves: [wave], claims: [makeAcceptedClaim(wave.id)] });
    await renderCenter();

    await act(async () => {
      (container.querySelector('[data-action="open-dispute"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="arbitration-sheet"]')).not.toBeNull();
    expect(container.textContent).toContain("有争议");

    const accept = container.querySelector('[data-action="accept-proposal"]') as HTMLButtonElement;
    await act(async () => {
      accept.click();
    });
    expect(useWaveStore.getState().fulfilment[wave.id]?.isSettled).toBe(true);
    expect(container.querySelector('[data-testid="arbitration-sheet"]')).toBeNull();
    root.unmount();
    container.remove();
  });

  it("争议入口 → 申请人工客服 → 冻结横幅（资金入人工仲裁队列）", async () => {
    const wave = makeWave({
      id: "w-hk-4",
      status: "locked" as const,
      ammoId: "housekeeping-v1",
    });
    useWaveStore.setState({ waves: [wave], claims: [makeAcceptedClaim(wave.id)] });
    await renderCenter();

    await act(async () => {
      (container.querySelector('[data-action="open-dispute"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-action="escalate-manual"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="escalated-banner"]')).not.toBeNull();
    expect(container.textContent).toContain("资金冻结中");
    root.unmount();
    container.remove();
  });

  it("P1 动态物证链：金额/诉求/存证照片均来自活动 Wave（静态演示桩已拔除）", async () => {
    const wave = makeWave({
      id: "w-hk-p1",
      status: "locked" as const,
      ammoId: "housekeeping-v1",
      budget: 400,
    });
    useWaveStore.setState({
      waves: [{ ...wave, negotiableNote: "厨房台面有水渍未擦净" }],
      claims: [makeAcceptedClaim(wave.id)],
    });
    await act(async () => {
      root.render(
        <FulfillmentCenter
          evidencePhotos={[{ photo: "cap-p1", aiNote: "水印存证 · 哈希 0a1b2c3d" }]}
        />,
      );
    });
    await act(async () => {
      (container.querySelector('[data-action="open-dispute"]') as HTMLButtonElement).click();
    });
    const sheet = container.querySelector('[data-testid="arbitration-sheet"]');
    expect(sheet).not.toBeNull();
    // 动态诉求（来自 negotiableNote）
    expect(sheet?.textContent).toContain("厨房台面有水渍未擦净");
    // 动态金额驱动三级分流（400 → LEVEL_2 区间，退款按 30% 折算 120）
    expect(sheet?.textContent).toContain("¥120");
    // 动态存证照片透传
    expect(sheet?.textContent).toContain("哈希 0a1b2c3d");
    // 旧静态演示桩文案彻底消失
    expect(sheet?.textContent).not.toContain("客厅角落仍有积灰");
    expect(sheet?.textContent).not.toContain("迟到 25 分钟");
    root.unmount();
    container.remove();
  });
});

describe("P1 动态仲裁金额与物证装配纯函数（确定性规则）", () => {
  it("buildDisputeProposal：小额全额退（L1 区间），中额 30% 折算，照抄金额驱动分流", () => {
    expect(buildDisputeProposal(20).refundAmount).toBe(20);
    expect(buildDisputeProposal(400).refundAmount).toBe(120);
    expect(buildDisputeProposal(600).refundAmount).toBe(180);
    expect(buildDisputeProposal(0).refundAmount).toBe(0);
  });

  it("buildDisputeProposal：存证照片计数进入理由链", () => {
    const p = buildDisputeProposal(400, 2);
    expect(p.reasonChain.join("")).toContain("2 张水印存证照片");
    expect(p.reasonChain.join("")).toContain("SHA-256");
  });

  it("buildDisputeEvidence：诉求/锚点来自真实 Wave 数据", () => {
    const ev = buildDisputeEvidence({
      basics: { category: "家政保洁", time: "明天 11:00", area: "幸福家园小区" },
      budget: 200,
      payAmount: 200,
      negotiableNote: "客厅角落遗留灰尘",
      customs: [{ text: "全屋除尘" }],
    });
    expect(ev.complaint).toContain("家政保洁 履约争议");
    expect(ev.complaint).toContain("客厅角落遗留灰尘");
    expect(ev.chatTranscript?.[0]).toContain("明天 11:00");
    expect(ev.chatTranscript?.[1]).toContain("全屋除尘");
  });

  it("buildDisputeEvidence：无诉求备注时以金额兜底，无照片时照片槽为空", () => {
    const ev = buildDisputeEvidence({
      basics: { category: "羽毛球约局", time: "周六 16:00", area: "滨江公园" },
      budget: 60,
    });
    expect(ev.complaint).toContain("¥60");
    expect(ev.photos).toEqual([]);
  });
});

/* ================= W4：插槽事件接线 ================= */

describe("W4 插槽事件接线（FulfillmentCenter 装配面）", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    resetStores();
  });

  async function renderWith(wave: Wave) {
    useWaveStore.setState({ waves: [wave], claims: [makeAcceptedClaim(wave.id)] });
    await act(async () => {
      root.render(<FulfillmentCenter />);
    });
  }

  it("保洁增项报价单 → 确认增项后订单总金额动态更新（budget + 增项）", async () => {
    const wave = makeWave({ id: "w-hk-5", status: "claimed" as const, ammoId: "housekeeping-v1" });
    await renderWith(wave);
    expect(container.querySelector('[data-testid="order-total"]')?.textContent).toContain("¥200");

    // 现场增项报价单弹出（未确认不叠加金额）
    await act(async () => {
      (container.querySelector('[data-action="suggest-quote"]') as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("深度除螨");
    expect(container.querySelector('[data-testid="order-total"]')?.textContent).toContain("¥200");

    // 雇主确认增项 → 订单总额动态更新 200 + 80 = 280（OnsiteQuoteHook 放行语义）
    const acceptQuote = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "确认增项",
    );
    expect(acceptQuote).not.toBeUndefined();
    await act(async () => {
      acceptQuote?.click();
    });
    expect(container.textContent).toContain("已确认 ✓");
    expect(container.querySelector('[data-testid="order-total"]')?.textContent).toContain("¥280");
    root.unmount();
    container.remove();
  });

  it("组局 500m 围栏扫码到场 → 定金解冻横幅（DELAY 引信放行）", async () => {
    const wave = makeWave({
      id: "w-mt-1",
      status: "locked" as const,
      ammoId: "meetup-social-v1",
      basics: { category: "羽毛球约局", time: "明天 19:00", area: "星羽羽毛球馆", radiusKm: 5 },
    });
    await renderWith(wave);
    expect(container.querySelector('[data-slot="meetup"]')).not.toBeNull();

    (container.querySelector('[data-action="scan-arrival"]') as HTMLButtonElement)?.click?.();
    // MeetupSlot 到场扫码按钮（data-action 未定义时按文本兜底）
    const scan = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("到场"),
    );
    if (scan) {
      await act(async () => {
        scan.click();
      });
    }
    expect(container.querySelector('[data-testid="deposit-unfrozen"]')).not.toBeNull();
    expect(container.textContent).toContain("定金已解冻");
    root.unmount();
    container.remove();
  });

  it("陪玩伪装假电话 → 全屏模拟来电遮罩 → 挂断脱身", async () => {
    const wave = makeWave({
      id: "w-cp-1",
      status: "claimed" as const,
      ammoId: "companion-v1",
      basics: { category: "陪玩", time: "今晚 20:00", area: "中央商圈", radiusKm: 5 },
    });
    await renderWith(wave);
    expect(container.querySelector('[data-slot="companion"]')).not.toBeNull();

    const fakeBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("伪装假电话"),
    );
    expect(fakeBtn).not.toBeUndefined();
    await act(async () => {
      fakeBtn?.click();
    });
    expect(container.querySelector('[data-testid="fake-call-overlay"]')).not.toBeNull();

    // 挂断脱身 → 遮罩关闭
    await act(async () => {
      (container.querySelector('[data-action="fake-call-hang"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="fake-call-overlay"]')).toBeNull();
    root.unmount();
    container.remove();
  });
});
