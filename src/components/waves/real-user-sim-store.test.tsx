// @vitest-environment jsdom
/**
 * 《阶段 1 拟人全链路大考 · 基础防线实测考卷（Store/座舱域）》
 *
 * 姊妹考卷（引擎/纯函数域见 src/ammo/real-user-sim-basic.test.ts）。
 * 本域覆盖 useWaveStore 真链路（发单 → 支付 → 王姐接单 → MATCHED →
 * 履约座舱装载 → SETTLED），因 store 走 @/ 别名 + persist(localStorage)，
 * 按 vitest.config exclude（src/base、src/ammo）在此 jsdom 域执行。
 *
 * 资金口径与引擎考卷同款：¥60/h × 2h = ¥120（12000 分），现场增项 ¥50
 * （客厅重污深度清洁）→ 订单总额 ¥170；D7 三比 85/10/5 → ¥144.50/¥17.00/¥8.50。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import FulfillmentCenter from "./FulfillmentCenter";
import StatusCapsule, { STATUS_CAPSULE_EMOJI } from "../oto-ui/StatusCapsule";
import {
  advanceLifecycle,
  evaluateAmmoFuze,
  toAtomicFiveState,
} from "@/base/ammo/runner";
import { calculateEscrowHold, generateComplianceSplitInstruction } from "@/base/money/escrow";
import { resolveAmmoIdForPublish } from "@/ammo/registry";
import { housekeepingAmmo } from "@/ammo/housekeeping.ammo";

/* =====================================================================
 * 考卷常量（与引擎域考卷同口径）
 * ===================================================================== */

const WAVE_CATEGORY = "家政保洁";
const WAVE_TIME = "周日 10:00";
const BASE_YUAN = 120;
const SURCHARGE_YUAN = 50;
const TOTAL_YUAN = BASE_YUAN + SURCHARGE_YUAN;
/** 供给端真实种子响应者（responders-catalog.ts 家政保洁 5 星「王姐」）。 */
const PROVIDER_ID = "mock-clean-wang";
const round2c = (n: number): number => Math.round(n * 100) / 100;

let authorId = "";

function resetStores() {
  useWaveStore.setState({ waves: [], claims: [], payOrders: [], fulfilment: {} });
  authorId = useIdentityStore.getState().identity.id;
}

describe("阶段1 拟人大考 · Store/座舱域（环节 3~6）", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    resetStores();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  /* ================= 环节 3：发布与资金托管锁定 ================= */

  it("环节3：createPendingWave → payWave → PUBLISHED（托管全款 ¥120 = 12000 分）", async () => {
    const created = useWaveStore.getState().createPendingWave({
      authorId,
      basics: { category: WAVE_CATEGORY, time: WAVE_TIME, area: "AI 撮合确认", radiusKm: 5 },
      budget: BASE_YUAN,
      customs: [],
      negotiable: false,
      capacity: 1,
      payAmount: BASE_YUAN,
      publishFee: 0,
      expiresAt: Date.now() + 7_200_000,
      hotness: 2,
      ammoId: resolveAmmoIdForPublish(WAVE_CATEGORY),
    });
    expect(created).not.toBeNull();
    expect(created!.blocked).toBeUndefined();
    expect(created!.removed).toBeUndefined();
    const waveId = created!.id;

    const wave = useWaveStore.getState().waves.find((w) => w.id === waveId);
    expect(wave).toBeDefined();
    expect(wave!.status).toBe("pending");
    expect(wave!.ammoId).toBe("housekeeping-v1");
    expect(wave!.basics.category).toBe(WAVE_CATEGORY);
    expect(wave!.basics.time).toBe(WAVE_TIME);
    expect(wave!.budget).toBe(BASE_YUAN);
    expect(toAtomicFiveState({ waveStatus: wave!.status })).toBe("PUBLISHED");

    const pay = useWaveStore.getState().payWave(waveId);
    expect(pay.ok).toBe(true);
    const paid = useWaveStore.getState().waves.find((w) => w.id === waveId);
    expect(paid!.status).toBe("active");
    const order = useWaveStore.getState().payOrders.find(
      (o) => o.waveId === waveId && o.payerId === authorId,
    );
    expect(order?.status).toBe("paid");
    expect(order?.amount).toBe(BASE_YUAN);

    // 托管锁定：全款冻结（服务前资金全程托管在平台侧）→ 分单位 12000
    const hold = calculateEscrowHold(BASE_YUAN);
    expect(hold).toEqual({ totalAmount: 120, heldDeposit: 120, payableAmount: 0 });
    expect(hold.totalAmount * 100).toBe(12000);

    // 引信闸门：背调 + 押金双闸（IMPACT 主武器）
    const blocked = evaluateAmmoFuze(housekeepingAmmo.fuzePolicy, { backgroundVerified: false });
    expect(blocked.pass).toBe(false);
    expect(blocked.checks.map((c) => c.rule).sort()).toEqual(["backgroundCheck", "deposit"]);
    const passed = evaluateAmmoFuze(housekeepingAmmo.fuzePolicy, {
      backgroundVerified: true,
      depositHeld: true,
    });
    expect(passed.pass).toBe(true);

    // 顶栏胶囊：🟡 寻找服务者中...
    await act(async () => {
      root.render(<StatusCapsule status={toAtomicFiveState({ waveStatus: "active" })} />);
    });
    expect(container.textContent).toContain("寻找服务者中...");
    expect(container.textContent).toContain(STATUS_CAPSULE_EMOJI.PUBLISHED);
  });

  /* ================= 环节 4：王姐接单 → MATCHED → 座舱装载 ================= */

  it("环节4：王姐直接接单 → claim accepted + MATCHED（🔵 服务者已就位）+ HousekeepingSlot 座舱", async () => {
    const created = useWaveStore.getState().createPendingWave({
      authorId,
      basics: { category: WAVE_CATEGORY, time: WAVE_TIME, area: "AI 撮合确认", radiusKm: 5 },
      budget: BASE_YUAN,
      customs: [],
      negotiable: false,
      capacity: 1,
      payAmount: BASE_YUAN,
      publishFee: 0,
      expiresAt: Date.now() + 7_200_000,
      hotness: 2,
      ammoId: resolveAmmoIdForPublish(WAVE_CATEGORY),
    });
    const waveId = created!.id;
    useWaveStore.getState().payWave(waveId);

    const opened = useWaveStore.getState().openClaim({
      waveId,
      responderId: PROVIDER_ID,
      note: "10:00 准时到，可应对重污",
      price: BASE_YUAN,
    });
    expect(opened.error).toBeUndefined();

    const claim = useWaveStore.getState().claims.find(
      (c) => c.waveId === waveId && c.responderId === PROVIDER_ID,
    );
    expect(claim).toBeDefined();
    expect(claim!.status).toBe("accepted");
    const wave = useWaveStore.getState().waves.find((w) => w.id === waveId);
    expect(wave!.status).toBe("claimed");
    expect(wave!.claimedById).toBe(PROVIDER_ID);
    expect(toAtomicFiveState({ waveStatus: wave!.status, claimStatus: claim!.status })).toBe(
      "MATCHED",
    );

    // ADR-0010：直接接单即分配双向虚拟号会话（隐私武装：aId=需求方 / bId=王姐）
    const session = useWaveStore.getState().privacySessions.find((s) => s.waveId === waveId);
    expect(session).toBeDefined();
    expect(session!.aId).toBe(authorId);
    expect(session!.bId).toBe(PROVIDER_ID);
    expect(session!.aNumber).toMatch(/^138-9000|^138-0000/);
    expect(session!.expiresAt - session!.allocatedAt).toBe(48 * 3600_000);

    // 履约座舱自适应装载：HousekeepingSlot（data-slot="housekeeping"）+ 顶栏 🔵
    await act(async () => {
      root.render(<FulfillmentCenter />);
    });
    expect(container.querySelector('[data-slot="housekeeping"]')).not.toBeNull();
    expect(container.textContent).toContain("损坏包赔");
    expect(container.querySelector('[data-testid="order-total"]')?.textContent).toContain("¥120");

    root.unmount();
    await act(async () => {
      root = createRoot(container);
      root.render(
        <StatusCapsule
          status={toAtomicFiveState({ waveStatus: "claimed", claimStatus: "accepted" })}
        />,
      );
    });
    expect(container.textContent).toContain("服务者已就位");
    expect(container.textContent).toContain(STATUS_CAPSULE_EMOJI.MATCHED);
  });

  /* ================= 环节 4b：到场履约 + 现场增项（先干后说价拦截） ================= */

  it("环节4b：MATCHED→IN_SERVICE（到点 + 增项确认放行）→ 订单总额 ¥170；未确认增项 BLOCK", async () => {
    const created = useWaveStore.getState().createPendingWave({
      authorId,
      basics: { category: WAVE_CATEGORY, time: WAVE_TIME, area: "AI 撮合确认", radiusKm: 5 },
      budget: BASE_YUAN,
      customs: [],
      negotiable: false,
      capacity: 1,
      payAmount: BASE_YUAN,
      publishFee: 0,
      expiresAt: Date.now() + 7_200_000,
      hotness: 2,
      ammoId: resolveAmmoIdForPublish(WAVE_CATEGORY),
    });
    const waveId = created!.id;
    useWaveStore.getState().payWave(waveId);
    useWaveStore.getState().openClaim({
      waveId,
      responderId: PROVIDER_ID,
      note: "10:00 准时到，可应对重污",
      price: BASE_YUAN,
    });

    // ① 未确认增项 → 引擎 BLOCK（禁止先干后说价）
    const blocked = await advanceLifecycle({
      ammo: housekeepingAmmo,
      orderId: waveId,
      from: "MATCHED",
      to: "IN_SERVICE",
      currentVersion: 0,
      expectedVersion: 0,
      payload: {
        arrival: { confirmed: true, at: Date.now() },
        onsiteQuote: { items: ["客厅重污深度清洁"], totalYuan: SURCHARGE_YUAN, approved: false },
        escrowPayload: { amount: BASE_YUAN, balance: 1000 },
      },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason ?? "").toMatch(/onsite-quote-pending/);

    // ② 确认增项 → 放行（现场增项 ¥50 ≤ 熔断线 ¥60 = 120×0.5）
    const t1 = await advanceLifecycle({
      ammo: housekeepingAmmo,
      orderId: waveId,
      from: "MATCHED",
      to: "IN_SERVICE",
      currentVersion: 0,
      expectedVersion: 0,
      payload: {
        arrival: { confirmed: true, at: Date.now() },
        onsiteQuote: { items: ["客厅重污深度清洁"], totalYuan: SURCHARGE_YUAN, approved: true },
        escrowPayload: { amount: BASE_YUAN, balance: 1000 },
      },
    });
    expect(t1.ok).toBe(true);
    expect(t1.state).toBe("IN_SERVICE");
    const quoteOutcome = t1.hookOutcomes.find((h) => h.hookId === "operator.onsite-quote");
    expect(quoteOutcome?.ok).toBe(true);

    // ③ 履约回写位 → 顶栏 🟣 履约保护中
    useWaveStore.getState().setFulfilment(waveId, { fulfilmentStatus: "reported" });
    expect(
      toAtomicFiveState({
        waveStatus: "claimed",
        claimStatus: "accepted",
        fulfilmentStatus: "reported",
      }),
    ).toBe("IN_SERVICE");
    await act(async () => {
      root.render(
        <StatusCapsule
          status={toAtomicFiveState({
            waveStatus: "claimed",
            claimStatus: "accepted",
            fulfilmentStatus: "reported",
          })}
        />,
      );
    });
    expect(container.textContent).toContain("履约保护中");
    expect(container.textContent).toContain(STATUS_CAPSULE_EMOJI.IN_SERVICE);

    // ④ 订单总额动态更新：120 + 50 = 170（与 FulfillmentCenter orderTotal 同式）
    const engineSum = BASE_YUAN + SURCHARGE_YUAN;
    expect(engineSum).toBe(TOTAL_YUAN);
  });

  /* ================= 环节 5：双拍验收 → INSPECTED（照片证据） ================= */

  it("环节5：IN_SERVICE→INSPECTED（双拍照片）→ 🟠 待验收与对账", async () => {
    const created = useWaveStore.getState().createPendingWave({
      authorId,
      basics: { category: WAVE_CATEGORY, time: WAVE_TIME, area: "AI 撮合确认", radiusKm: 5 },
      budget: BASE_YUAN,
      customs: [],
      negotiable: false,
      capacity: 1,
      payAmount: BASE_YUAN,
      publishFee: 0,
      expiresAt: Date.now() + 7_200_000,
      hotness: 2,
      ammoId: resolveAmmoIdForPublish(WAVE_CATEGORY),
    });
    const waveId = created!.id;
    useWaveStore.getState().payWave(waveId);
    useWaveStore.getState().openClaim({
      waveId,
      responderId: PROVIDER_ID,
      note: "10:00 准时到，可应对重污",
      price: BASE_YUAN,
    });

    const t1 = await advanceLifecycle({
      ammo: housekeepingAmmo,
      orderId: waveId,
      from: "MATCHED",
      to: "IN_SERVICE",
      currentVersion: 0,
      expectedVersion: 0,
      payload: {
        arrival: { confirmed: true, at: Date.now() },
        onsiteQuote: { items: ["客厅重污深度清洁"], totalYuan: SURCHARGE_YUAN, approved: true },
        escrowPayload: { amount: BASE_YUAN, balance: 1000 },
      },
    });
    expect(t1.ok).toBe(true);

    const t2 = await advanceLifecycle({
      ammo: housekeepingAmmo,
      orderId: waveId,
      from: "IN_SERVICE",
      to: "INSPECTED",
      currentVersion: 1,
      expectedVersion: 1,
      payload: {
        photos: { before: ["wm-before-hk-001"], after: ["wm-after-hk-001"] },
      },
    });
    expect(t2.ok).toBe(true);
    expect(t2.state).toBe("INSPECTED");
    const cleaning = t2.hookOutcomes.find((h) => h.hookId === "operator.cleaning-check");
    expect(cleaning?.ok).toBe(true);

    useWaveStore.getState().setFulfilment(waveId, { fulfilmentStatus: "confirmed" });
    expect(
      toAtomicFiveState({
        waveStatus: "claimed",
        claimStatus: "accepted",
        fulfilmentStatus: "confirmed",
      }),
    ).toBe("INSPECTED");
    await act(async () => {
      root.render(
        <StatusCapsule
          status={toAtomicFiveState({
            waveStatus: "claimed",
            claimStatus: "accepted",
            fulfilmentStatus: "confirmed",
          })}
        />,
      );
    });
    expect(container.textContent).toContain("待验收与对账");
    expect(container.textContent).toContain(STATUS_CAPSULE_EMOJI.INSPECTED);
  });

  /* ================= 环节 6：SETTLED 结算分账（85/10/5 守恒） ================= */

  it("环节6：INSPECTED→SETTLED → 引擎对账 90/10 + D7 指令 85/10/5 → 🟢 订单已圆满结算", async () => {
    const created = useWaveStore.getState().createPendingWave({
      authorId,
      basics: { category: WAVE_CATEGORY, time: WAVE_TIME, area: "AI 撮合确认", radiusKm: 5 },
      budget: BASE_YUAN,
      customs: [],
      negotiable: false,
      capacity: 1,
      payAmount: BASE_YUAN,
      publishFee: 0,
      expiresAt: Date.now() + 7_200_000,
      hotness: 2,
      ammoId: resolveAmmoIdForPublish(WAVE_CATEGORY),
    });
    const waveId = created!.id;
    useWaveStore.getState().payWave(waveId);
    useWaveStore.getState().openClaim({
      waveId,
      responderId: PROVIDER_ID,
      note: "10:00 准时到，可应对重污",
      price: BASE_YUAN,
    });

    const t1 = await advanceLifecycle({
      ammo: housekeepingAmmo,
      orderId: waveId,
      from: "MATCHED",
      to: "IN_SERVICE",
      currentVersion: 0,
      expectedVersion: 0,
      payload: {
        arrival: { confirmed: true, at: Date.now() },
        onsiteQuote: { items: ["客厅重污深度清洁"], totalYuan: SURCHARGE_YUAN, approved: true },
        escrowPayload: { amount: BASE_YUAN, balance: 1000 },
      },
    });
    const t2 = await advanceLifecycle({
      ammo: housekeepingAmmo,
      orderId: waveId,
      from: "IN_SERVICE",
      to: "INSPECTED",
      currentVersion: 1,
      expectedVersion: 1,
      payload: { photos: { before: ["wm-before-hk-001"], after: ["wm-after-hk-001"] } },
    });
    expect(t1.ok).toBe(true);
    expect(t2.ok).toBe(true);

    const t3 = await advanceLifecycle({
      ammo: housekeepingAmmo,
      orderId: waveId,
      from: "INSPECTED",
      to: "SETTLED",
      currentVersion: 2,
      expectedVersion: 2,
      payload: { escrowPayload: { amount: TOTAL_YUAN, platformRate: 0.1, participants: 1 } },
    });
    expect(t3.ok).toBe(true);
    expect(t3.state).toBe("SETTLED");
    const ledger = t3.afterData.find(
      (d): d is { settlementLedger: { hold: { totalAmount: number }; split: { platformIncome: number; providerIncome: number }; providerIncome: number; platformIncome: number; demanderRefund: number } } =>
        typeof d === "object" && d !== null && "settlementLedger" in d,
    );
    expect(ledger).toBeDefined();
    expect(ledger!.settlementLedger.hold.totalAmount).toBe(TOTAL_YUAN);
    expect(ledger!.settlementLedger.split.platformIncome).toBe(17);
    expect(ledger!.settlementLedger.split.providerIncome).toBe(153);
    expect(
      ledger!.settlementLedger.split.platformIncome +
        ledger!.settlementLedger.split.providerIncome +
        ledger!.settlementLedger.demanderRefund,
    ).toBe(TOTAL_YUAN);

    // D7 三比 85/10/5 严格守恒（¥144.50 / ¥17.00 / ¥8.50 ≡ ¥170）
    const providerYuan = round2c(TOTAL_YUAN * 0.85);
    const platformYuan = round2c(TOTAL_YUAN * 0.1);
    const insuranceYuan = round2c(TOTAL_YUAN * 0.05);
    expect(providerYuan).toBe(144.5);
    expect(platformYuan).toBe(17);
    expect(insuranceYuan).toBe(8.5);
    expect(providerYuan + platformYuan + insuranceYuan).toBe(TOTAL_YUAN);

    // 微信收付通合规分账指令（S4 防二清）
    const instruction = generateComplianceSplitInstruction(
      { platformFee: platformYuan, providerNet: providerYuan },
      "WECHAT_PAY",
      { orderId: waveId, receiverAccountId: `sub-wx-provider-${PROVIDER_ID}` },
    );
    expect(instruction.instructionId).toBe(`split-${waveId}-WECHAT_PAY`);
    expect(instruction.splitAmountYuan).toBe(144.5);
    expect(instruction.platformFeeYuan).toBe(17);
    expect(instruction.demanderRefundYuan).toBe(0);
    expect(instruction.isMirrorLedgerOnly).toBe(true);
    expect(instruction.instructionSignature).toMatch(/^sig-[0-9a-f]{8}$/);

    // 终局回写位 → 🟢 订单已圆满结算 + 座舱卸载
    useWaveStore.getState().setFulfilment(waveId, { isSettled: true });
    const settledState = toAtomicFiveState({
      waveStatus: "claimed",
      claimStatus: "accepted",
      isSettled: true,
    });
    expect(settledState).toBe("SETTLED");
    await act(async () => {
      root.render(
        <>
          <FulfillmentCenter />
          <StatusCapsule status={settledState} />
        </>,
      );
    });
    expect(container.textContent).toContain("订单已圆满结算");
    expect(container.textContent).toContain(STATUS_CAPSULE_EMOJI.SETTLED);
    expect(container.querySelector('[data-slot="housekeeping"]')).toBeNull();
  });
});
