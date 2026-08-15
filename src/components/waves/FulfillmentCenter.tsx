"use client";

import { useMemo, useState } from "react";
import type { AtomicFiveState } from "@/types/ammo-schema";
import { advanceLifecycle } from "@/base/ammo/runner";
import { getAmmoById } from "@/ammo/registry";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { toAtomicFiveState } from "@/base/ammo/runner";
import FulfillmentCockpit, { type CockpitScenario } from "./FulfillmentCockpit";
import ArbitrationSheet, {
  type ArbitrationEvidence,
  type ArbitrationProposal,
} from "./ArbitrationSheet";
import type { HousekeepingQuote } from "./slots/HousekeepingSlot";
import type { MeetupSeat } from "./slots/MeetupSlot";

/**
 * W3~W5 总装：Trip 屏通用履约座舱装配中心。
 *
 * 职责：
 * 1. 从 useWaveStore 选取当前用户进行中的 Wave（claimed/locked/assembled + accepted/joined 单），
 *    toAtomicFiveState 投影 → 仅 MATCHED / IN_SERVICE / INSPECTED 三态挂载 Cockpit（W3）；
 * 2. 按 ammoId（housekeeping-v1 / meetup-social-v1 / companion-v1）毫秒自适应装载场景插槽（W3）；
 * 3. 插槽事件接线（W4）：保洁增项确认 → 订单总额动态更新；组局 500m 围栏扫码到场 → 解锁定金；
 *    陪玩伪装假电话 → 全屏模拟来电遮罩（接听/挂断脱身）；
 * 4. 核销 CTA 真实调用 AmmoRunner.advanceLifecycle（W5 · 生产首次调用引擎），流转结果
 *    setFulfilment 同步回 store → toAtomicFiveState 投影 → 顶栏 StatusCapsule 实时流转 🟢；
 * 5. 争议入口（⚖️ 有争议 + 插槽内申诉）→ ArbitrationSheet（W7 联动）。
 */

/** 纯函数：wave → 场景插槽键（ammoId 优先，中文类目兜底）。 */
export function resolveCockpitScenario(wave: {
  ammoId?: string;
  basics: { category: string };
}): CockpitScenario {
  const ammoId = wave.ammoId ?? "";
  if (ammoId === "housekeeping-v1") return "housekeeping";
  if (ammoId === "meetup-social-v1") return "meetup";
  if (ammoId === "companion-v1") return "companion";
  const cat = wave.basics.category;
  if (/家政|保洁|打扫|水电|维修|搬家/.test(cat)) return "housekeeping";
  if (/陪玩|交友|dating|social/.test(cat)) return "companion";
  if (/羽毛球|约局|组局|桌游|拼桌/.test(cat)) return "meetup";
  return "meetup";
}

/** 纯函数：五态是否需要挂载履约座舱（MATCHED / IN_SERVICE / INSPECTED）。 */
export function needsCockpit(state: AtomicFiveState | null): boolean {
  return state === "MATCHED" || state === "IN_SERVICE" || state === "INSPECTED";
}

/** 纯函数：当前态 → 核销 CTA 目标态（MATCHED→IN_SERVICE→INSPECTED→SETTLED）。 */
export function nextCockpitState(state: AtomicFiveState): AtomicFiveState {
  switch (state) {
    case "MATCHED":
      return "IN_SERVICE";
    case "IN_SERVICE":
      return "INSPECTED";
    case "INSPECTED":
      return "SETTLED";
    default:
      return state;
  }
}

/** 核销 CTA 文案（按当前态动态）。 */
export function describeCtaForState(state: AtomicFiveState): string {
  switch (state) {
    case "MATCHED":
      return "🚀 开始履约 · 服务者已就位";
    case "IN_SERVICE":
      return "📱 双方碰一碰 / 扫码确认完工";
    case "INSPECTED":
      return "✅ 确认收款 · 完成结算";
    default:
      return "核销";
  }
}

/** 演示座次表（组局 4 席，500m 围栏签到）。 */
const DEMO_SEATS: MeetupSeat[] = [
  { id: "s1", name: "发起人", arrived: true },
  { id: "s2", name: "队友 A", arrived: false },
  { id: "s3", name: "队友 B", arrived: false },
  { id: "s4", name: "队友 C", arrived: false },
];

const CENTER_CSS = `
.fc-wrap{display:flex;flex-direction:column;gap:8px}
.fc-dispute-row{display:flex;justify-content:flex-end}
.fc-dispute{border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.1);color:#fbbf24;
  font-size:12px;font-weight:800;padding:7px 14px;border-radius:999px;cursor:pointer}
.fc-total{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:14px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-size:13px}
.fc-total strong{color:#4ade80;font-size:15px}
.fc-frozen{font-size:10.5px;color:#4ade80;text-align:center;padding:6px;border-radius:10px;
  background:rgba(74,222,128,.1);border:1px dashed rgba(74,222,128,.4)}
.fc-note{font-size:10.5px;color:#94a3b8;text-align:center}
.fc-call-mask{position:fixed;inset:0;z-index:90;background:rgba(3,4,10,.88);backdrop-filter:blur(6px);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#e2e8f0}
.fc-call-avatar{width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#7c3aed);
  display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 44px rgba(124,58,237,.5)}
.fc-call-meta{text-align:center}
.fc-call-meta strong{font-size:18px}
.fc-call-meta p{font-size:12px;color:#94a3b8;margin:4px 0 0}
.fc-call-btns{display:flex;gap:40px;margin-top:8px}
.fc-call-btn{width:64px;height:64px;border-radius:50%;border:none;font-size:11px;font-weight:800;cursor:pointer}
.fc-call-accept{background:linear-gradient(135deg,#4ade80,#16a34a);color:#04120a}
.fc-call-hang{background:linear-gradient(135deg,#f87171,#dc2626);color:#fff}
`;

/** Trip 屏履约座舱装配中心（无进行中单 → 不渲染）。 */
export default function FulfillmentCenter() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const fulfilment = useWaveStore((s) => s.fulfilment);
  const setFulfilment = useWaveStore((s) => s.setFulfilment);
  const identity = useIdentityStore((s) => s.identity);

  // W3：当前用户进行中 Wave（投影三态可挂载）
  const activeWave = useMemo(() => {
    const mine = waves
      .filter(
        (w) =>
          w.authorId === identity.id &&
          w.status !== "closed" &&
          w.status !== "expired" &&
          w.status !== "pending" &&
          !w.removed,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    return mine[0] ?? null;
  }, [waves, identity.id]);

  const activeClaim = useMemo(() => {
    if (!activeWave) return null;
    return (
      claims.find(
        (c) =>
          c.waveId === activeWave.id &&
          (c.status === "accepted" || c.status === "joined"),
      ) ?? null
    );
  }, [activeWave, claims]);

  const currentState = useMemo(() => {
    if (!activeWave) return null;
    const flags = fulfilment[activeWave.id];
    return toAtomicFiveState({
      waveStatus: activeWave.status,
      claimStatus: activeClaim?.status,
      fulfilmentStatus: flags?.fulfilmentStatus,
      isSettled: flags?.isSettled,
    });
  }, [activeWave, activeClaim, fulfilment]);

  // 插槽本地状态（W4）
  const [hkQuote, setHkQuote] = useState<HousekeepingQuote | null>(null);
  const [seats, setSeats] = useState<MeetupSeat[]>(DEMO_SEATS);
  const [depositUnfrozen, setDepositUnfrozen] = useState(false);
  const [fakeCallOpen, setFakeCallOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [transitError, setTransitError] = useState<string | null>(null);

  const scenario: CockpitScenario | null = activeWave
    ? resolveCockpitScenario(activeWave)
    : null;
  const ammo = useMemo(
    () => (activeWave ? getAmmoById(activeWave.ammoId ?? activeWave.basics.category) : null),
    [activeWave],
  );

  if (!activeWave || !currentState || !needsCockpit(currentState) || !scenario || !ammo) {
    return null;
  }

  // early-return 收窄重绑定（闭包捕获用非空局部常量）
  const wave: typeof activeWave = activeWave;
  const state: AtomicFiveState = currentState;
  const ammoDef = ammo;
  const sc: CockpitScenario = scenario;
  const orderTotal = wave.budget + (hkQuote?.confirmed ? hkQuote.amountYuan : 0);

  // W5：核销 CTA 生产首次调用引擎（advanceLifecycle 真实跃迁）
  async function handleComplete() {
    setTransitError(null);
    const to = nextCockpitState(state);
    const res = await advanceLifecycle({
      ammo: ammoDef,
      orderId: wave.id,
      from: state,
      to,
      payload: {
        scenario: sc,
        totalYuan: orderTotal,
        quotedItems: hkQuote?.confirmed ? [hkQuote.item] : [],
      },
    });
    if (!res.ok) {
      setTransitError(res.reason ?? "跃迁被拦截");
      return;
    }
    setFulfilment(wave.id, {
      fulfilmentStatus: res.state === "IN_SERVICE" ? "reported" : res.state === "INSPECTED" ? "confirmed" : undefined,
      isSettled: res.state === "SETTLED",
    });
  }

  // W7 联动：接受调解方案 → 违约赔付载荷 → SETTLED
  async function handleAcceptProposal() {
    const res = await advanceLifecycle({
      ammo: ammoDef,
      orderId: wave.id,
      from: state,
      to: "SETTLED",
      termination: {
        kind: "BREACH_SETTLED",
        payload: {
          refundAmount: DISPUTE_PROPOSAL.refundAmount,
          creditDeduct: DISPUTE_PROPOSAL.creditDeduct,
          ammoId: ammoDef.ammoId,
        },
      },
    });
    if (res.ok) {
      setFulfilment(wave.id, { isSettled: true });
      setDisputeOpen(false);
    } else {
      setTransitError(res.reason ?? "调解结算失败");
    }
  }

  // W7 联动：申请人工客服 → 冻结资金进入人工仲裁队列
  function handleEscalateManual() {
    setEscalated(true);
    setDisputeOpen(false);
  }

  const provider = {
    avatar: "🧑‍🔧",
    name: `服务者 · ${(activeClaim?.responderId ?? "待接单").slice(-4)}`,
    verified: true,
    trustScore: 88,
  };

  return (
    <div className="fc-wrap" data-testid="fulfillment-center" data-scenario={sc}>
      <style>{CENTER_CSS}</style>

      {/* W7：争议入口（座舱右上角） */}
      <div className="fc-dispute-row">
        <button
          type="button"
          className="fc-dispute"
          data-action="open-dispute"
          onClick={() => setDisputeOpen(true)}
        >
          ⚖️ 有争议 · 申诉
        </button>
      </div>

      <FulfillmentCockpit
        status={state}
        scenario={sc}
        capsule={{
          isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
          distanceMeters: scenario === "meetup" ? 500 : scenario === "companion" ? 300 : undefined,
        }}
        provider={provider}
        housekeeping={{
          quote: hkQuote ?? undefined,
          photos: { before: null, after: null },
          onAcceptQuote: () => setHkQuote((q) => (q ? { ...q, confirmed: true } : q)),
          onRejectQuote: () => setHkQuote(null),
          onClaimDamage: () => setDisputeOpen(true),
        }}
        meetup={{
          seats,
          fenceMeters: 500,
          onScanArrival: () => {
            // W4：500m 围栏到场扫码 → 到场验真 → 解锁定金
            setSeats((prev) =>
              prev.map((s, i) => (i > 0 && !s.arrived ? { ...s, arrived: true } : s)),
            );
            setDepositUnfrozen(true);
          },
          split: {
            entries: [
              { party: "发起人", deltaYuan: -20 },
              { party: "队友 A", deltaYuan: 12 },
              { party: "队友 B", deltaYuan: 12 },
              { party: "队友 C", deltaYuan: -4 },
            ],
            totalYuan: wave.budget,
          },
          onDisputeNoShow: () => setDisputeOpen(true),
        }}
        companion={{
          isPrivacyShieldArmed: true,
          onTriggerFakeCall: () => setFakeCallOpen(true),
          onBlockUser: () => setDisputeOpen(true),
        }}
        onComplete={() => void handleComplete()}
      />

      {/* W4：保洁增项 → 订单总额动态更新 */}
      {sc === "housekeeping" && !hkQuote && (
        <button
          type="button"
          className="fc-dispute"
          style={{ width: "100%", borderRadius: 14, padding: "9px 0", borderColor: "rgba(56,132,255,.45)", background: "rgba(56,132,255,.1)", color: "#7fb2ff" }}
          data-action="suggest-quote"
          onClick={() => setHkQuote({ item: "深度除螨", amountYuan: 80, confirmed: false })}
        >
          ➕ 现场增项改价：深度除螨 +¥80（OnsiteQuoteHook）
        </button>
      )}
      <div className="fc-total" data-testid="order-total">
        <span>💰 订单总金额（含增项）</span>
        <strong>¥{orderTotal}</strong>
      </div>

      {/* W4：组局围栏扫码 → 定金解冻提示 */}
      {sc === "meetup" && depositUnfrozen && (
        <div className="fc-frozen" data-testid="deposit-unfrozen">
          🔓 500m 围栏到场验真通过 · 定金已解冻（DELAY 引信放行）
        </div>
      )}

      {/* W7：人工仲裁受理横幅 */}
      {escalated && (
        <div className="fc-frozen" data-testid="escalated-banner" style={{ color: "#fbbf24", background: "rgba(251,191,36,.1)", borderColor: "rgba(251,191,36,.45)" }}>
          🧑‍⚖️ 已提交人工仲裁 · 资金冻结中（进入人工仲裁队列）
        </div>
      )}

      {transitError && (
        <div className="fc-note" style={{ color: "#fca5a5" }} data-testid="transit-error">
          ⚠️ {transitError}
        </div>
      )}

      {/* W5：核销 CTA（当前态 → 下一态）文案由 FulfillmentCockpit 底部 CTA 承载，
          此处承接 onComplete 已接线；舱内底部 CTA 文案按场景特化，叠加动态态文案 */}
      <div className="fc-note" data-testid="cta-hint">
        {describeCtaForState(currentState)} · 当前五态 {currentState} → 下一态{" "}
        {nextCockpitState(currentState)}
      </div>

      {/* W4：陪玩伪装假电话 · 全屏模拟来电遮罩（接听/挂断脱身） */}
      {fakeCallOpen && (
        <div className="fc-call-mask" data-testid="fake-call-overlay">
          <div className="fc-call-avatar">🎭</div>
          <div className="fc-call-meta">
            <strong>伪装来电 · 脱身中</strong>
            <p>来电号码 138 **** 2026 · 隐私号代拨</p>
          </div>
          <div className="fc-call-btns">
            <button
              type="button"
              className="fc-call-btn fc-call-accept"
              data-action="fake-call-accept"
              onClick={() => setFakeCallOpen(false)}
            >
              接听
            </button>
            <button
              type="button"
              className="fc-call-btn fc-call-hang"
              data-action="fake-call-hang"
              onClick={() => setFakeCallOpen(false)}
            >
              挂断
            </button>
          </div>
        </div>
      )}

      {/* W7：争议调解半屏抽屉 */}
      <ArbitrationSheet
        open={disputeOpen}
        orderId={wave.id}
        ammoId={ammoDef.ammoId}
        currentState={currentState}
        evidence={DISPUTE_EVIDENCE}
        proposal={DISPUTE_PROPOSAL}
        onAcceptProposal={() => void handleAcceptProposal()}
        onEscalateManual={handleEscalateManual}
        onClose={() => setDisputeOpen(false)}
      />
    </div>
  );
}

/** 演示物证比对链（数据湖存证锚点语义）。 */
const DISPUTE_EVIDENCE: ArbitrationEvidence = {
  complaint: "保洁完工后客厅角落仍有积灰，且预约时段迟到 25 分钟，要求部分退款。",
  providerStatement: "已按清单完成全屋保洁，角落为家具遮挡残留，可提供完工照片。",
  photos: [
    { photo: "work-done", aiNote: "检测到客厅角落存在除尘残留（置信度 0.87）" },
    { photo: "work-done-2", aiNote: "其余区域清洁度合格（置信度 0.92）" },
  ],
  chatTranscript: [
    "雇主 14:02：师傅大概几点到？",
    "履约方 14:10：路上堵车，预计 14:35 到（实际 14:40 到达）",
    "雇主 18:12：客厅角落灰尘没清理干净",
  ],
};

/** 演示 AI 小法官建议卡（仅 Advisory，红线 1）。 */
const DISPUTE_PROPOSAL: ArbitrationProposal = {
  liability: "split",
  liabilityNote: "迟到 + 局部清洁不达标由履约方承担，房屋整体完工度良好双方认可",
  refundAmount: 60,
  compensationCouponYuan: 20,
  creditDeduct: 10,
  reasonChain: [
    "规则 R-1：预约迟到 >15 分钟 → 履约方担责（证据：聊天时间戳锚点）",
    "规则 R-2：完工照片 AI 标注局部残留 → 按 8% 工费折算退款",
    "规则 R-3：雇主无恶意索赔记录 → 平台补偿券安抚双方",
  ],
};
