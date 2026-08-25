"use client";

import { useEffect, useMemo, useState } from "react";
import type { AtomicFiveState } from "@/types/ammo-schema";
import { advanceLifecycle } from "@/base/ammo/runner";
import { getAmmoById } from "@/ammo/registry";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { toAtomicFiveState } from "@/base/ammo/runner";
import { evaluateRuntimeSafety } from "@/base/safe/runtime-monitor";
import { startGeoTracker, stopGeoTracker } from "@/base/platform/geo-tracker";
import {
  startAudioVault,
  stopAudioVault,
} from "@/base/platform/audio-recorder";
import FulfillmentCockpit, { type CockpitScenario } from "./FulfillmentCockpit";
import DialCard from "./DialCard";
import ArbitrationSheet, {
  type ArbitrationEvidence,
  type ArbitrationPhotoEvidence,
  type ArbitrationProposal,
} from "./ArbitrationSheet";
import { toast } from "@/base/platform/toast";
import { personaAvatarForBot } from "@/base/platform/sandbox-bot";
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

/** 特化插槽键 → 制式场景映射（弹药 cockpitSlot 声明优先，宪法 #4 弹药可插拔）。 */
export const COCKPIT_SLOT_SCENARIO: Record<string, CockpitScenario> = {
  HousekeepingSlot: "housekeeping",
  MeetupSlot: "meetup",
  CompanionSlot: "companion",
};

/**
 * 纯函数：wave → 场景插槽键（D8 弹药声明 cockpitSlot 优先，ammoId 次之，
 * 中文类目兜底；未命中制式 → dynamic 通用插槽，零白屏）。
 */
export function resolveCockpitScenario(wave: {
  ammoId?: string;
  basics: { category: string };
}): CockpitScenario {
  const ammoId = wave.ammoId ?? "";
  // ① 动态弹药声明的特化插槽键优先（如 DRONE_CROP_SPRAY cockpitSlot=HousekeepingSlot → 家政）
  if (ammoId) {
    const slot = getAmmoById(ammoId).holographic?.cockpitSlot;
    if (slot && COCKPIT_SLOT_SCENARIO[slot]) return COCKPIT_SLOT_SCENARIO[slot];
  }
  if (ammoId === "housekeeping-v1") return "housekeeping";
  if (ammoId === "meetup-social-v1") return "meetup";
  if (ammoId === "companion-v1") return "companion";
  const cat = wave.basics.category;
  if (/家政|保洁|打扫|水电|维修|搬家/.test(cat)) return "housekeeping";
  if (/陪玩|交友|dating|social/.test(cat)) return "companion";
  if (/羽毛球|约局|组局|桌游|拼桌/.test(cat)) return "meetup";
  return "dynamic";
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
export default function FulfillmentCenter({
  evidencePhotos = [],
}: {
  /** 投诉方已上传的存证照片（AR 拍照存证 / 履约照片），动态透传进争议物证链。 */
  evidencePhotos?: ArbitrationPhotoEvidence[];
}) {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const responders = useWaveStore((s) => s.responders);
  const fulfilment = useWaveStore((s) => s.fulfilment);
  const setFulfilment = useWaveStore((s) => s.setFulfilment);
  const closeWave = useWaveStore((s) => s.closeWave);
  const raiseCrisis = useWaveStore((s) => s.raiseCrisis);
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
  /** P0 接电：📞 一键虚拟通话弹层（DialCard 一次性线路）。 */
  const [dialOpen, setDialOpen] = useState(false);

  const scenario: CockpitScenario | null = activeWave
    ? resolveCockpitScenario(activeWave)
    : null;
  const ammo = useMemo(
    () => (activeWave ? getAmmoById(activeWave.ammoId ?? activeWave.basics.category) : null),
    [activeWave],
  );

  // P1-3 一键 SOS 联动武装：按弹药 fuzePolicy.sos 声明式开关启动轨迹/录音采集
  // （条文 #5 引信跟弹药走；无权限/无硬件静默降级，卸载/换单即停采）。
  const sosFuze = ammo?.holographic?.fuzePolicy?.sos;
  useEffect(() => {
    if (!sosFuze?.enabled || !activeWave?.id) return;
    startGeoTracker(sosFuze.autoLocationReport);
    void startAudioVault(activeWave.id, sosFuze.autoEvidenceAppend);
    return () => {
      stopGeoTracker();
      stopAudioVault();
    };
  }, [
    sosFuze?.enabled,
    sosFuze?.autoLocationReport,
    sosFuze?.autoEvidenceAppend,
    activeWave?.id,
  ]);

  // P1：争议物证链真实化 —— 从当前活动 Wave（金额/诉求/存证照片）动态装配，
  // 彻底拔除静态演示桩 DISPUTE_EVIDENCE / DISPUTE_PROPOSAL。
  // （hooks 必须位于 early-return 之前，wave 为空时产出 null 由收窄分支容忍）
  const disputeAmount = activeWave ? activeWave.budget : 0;
  const disputeEvidence = useMemo(
    () => (activeWave ? buildDisputeEvidence(activeWave, evidencePhotos) : null),
    [activeWave, evidencePhotos],
  );
  const disputeProposal = useMemo(
    () => (activeWave ? buildDisputeProposal(disputeAmount, evidencePhotos.length) : null),
    [activeWave, disputeAmount, evidencePhotos.length],
  );

  // D8 动态弹药插槽透传：订单固化参数快照（basics 除 category/time/area 外的自定义键）
  const bizParams = useMemo(() => {
    if (!activeWave) return undefined;
    const { category: _c, time: _t, area: _a, ...rest } =
      activeWave.basics as unknown as Record<string, unknown>;
    return Object.keys(rest).length > 0 ? rest : undefined;
  }, [activeWave]);

  // 阶段4：运行时多因子安全评估（敏感定制/夜间/基础风险 → 引信自适应升级）。
  // hourOfDay 取真实本地时刻（夜间 22:00-05:59 +20）；家政入户基础风险 20。
  const safety = useMemo(() => {
    if (!activeWave || !scenario) return null;
    return evaluateRuntimeSafety({
      ammoId: activeWave.ammoId ?? "",
      orderId: activeWave.id,
      baseRiskScore: scenario === "housekeeping" ? 20 : 0,
      customRequirements: activeWave.customRequirements,
      hourOfDay: new Date().getHours(),
    });
  }, [activeWave, scenario]);

  if (!activeWave || !currentState || !needsCockpit(currentState) || !scenario || !ammo) {
    return null;
  }

  // early-return 收窄重绑定（闭包捕获用非空局部常量）
  const wave: typeof activeWave = activeWave;
  const state: AtomicFiveState = currentState;
  const ammoDef = ammo;
  const sc: CockpitScenario = scenario;
  const orderTotal = wave.budget + (hkQuote?.confirmed ? hkQuote.amountYuan : 0);
  const dEvidence = disputeEvidence!;
  const dProposal = disputeProposal!;

  // P1 缺陷 1 修复：双拍门禁 —— WATERMARK_CAMERA 弹药（家政入户）完工验收前必须
  // 完成 Before/After 双拍存证（红线 4 零信任物理感知）。照片相位沿用动态插槽
  // 既有约定：evidencePhotos[0]=Before、evidencePhotos[1]=After（ProofCamera 存证序列）。
  const needsPhotoProof =
    ammoDef.holographic?.requiredSensors?.includes("WATERMARK_CAMERA") ?? false;
  const beforePhoto = evidencePhotos[0]?.photo ?? null;
  const afterPhoto = evidencePhotos[1]?.photo ?? null;
  function buildPhotoPayload() {
    if (!needsPhotoProof || !beforePhoto || !afterPhoto) return {};
    return { photos: { before: [beforePhoto], after: [afterPhoto] } };
  }

  // W5：核销 CTA 生产首次调用引擎（advanceLifecycle 真实跃迁）
  async function handleComplete() {
    setTransitError(null);
    const to = nextCockpitState(state);
    if (to === "INSPECTED" && needsPhotoProof && (!beforePhoto || !afterPhoto)) {
      toast("⚠️ 请先完成服务前后双拍存证（红线 4 零信任物理感知）", "error");
      setTransitError("请先完成服务前后双拍存证");
      return;
    }
    const res = await advanceLifecycle({
      ammo: ammoDef,
      orderId: wave.id,
      from: state,
      to,
      payload: {
        scenario: sc,
        totalYuan: orderTotal,
        quotedItems: hkQuote?.confirmed ? [hkQuote.item] : [],
        ...buildPhotoPayload(),
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
    // Step 2 接电：跃迁结果 write-behind 同步权威库（幂等键含 from:to:version 防重放）
    useWaveStore.getState().syncOrderOp({
      kind: "order-transition",
      payload: JSON.stringify({
        path: `/api/orders/${wave.id}/transition`,
        idempotencyKey: `tr:${wave.id}:${state}:${res.state}`,
        body: {
          fromState: state,
          toState: res.state,
          expectedVersion: -1,
          ammoSnapshot: ammoDef,
        },
        transitionReason: "FULFILMENT_COCKPIT_TRANSITION",
      }),
    });
    // P1 缺陷 2 修复：SETTLED 终局 → 同步归档 wave（释放 activeWave 槽位，后续 MATCHED 单可正常载入座舱）
    if (res.state === "SETTLED") {
      closeWave(wave.id);
    }
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
          refundAmount: dProposal.refundAmount,
          creditDeduct: dProposal.creditDeduct,
          ammoId: ammoDef.ammoId,
        },
      },
    });
    if (res.ok) {
      setFulfilment(wave.id, { isSettled: true });
      // Step 2 接电：违约调解 SETTLED 终局 write-behind 同步权威库（终止事件路径）
      useWaveStore.getState().syncOrderOp({
        kind: "order-transition",
        payload: JSON.stringify({
          path: `/api/orders/${wave.id}/transition`,
          idempotencyKey: `tr:${wave.id}:BREACH_SETTLED`,
          body: {
            fromState: state,
            toState: "SETTLED",
            expectedVersion: -1,
            ammoSnapshot: ammoDef,
            termination: {
              kind: "BREACH_SETTLED",
              payload: { refundAmount: dProposal.refundAmount },
            },
          },
          transitionReason: "TERMINATION_BREACH_SETTLED",
        }),
      });
      // P1 缺陷 2 修复：争议调解达成（BREACH_SETTLED）同样归档 wave，释放活动槽位
      closeWave(wave.id);
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

  // P0 Bot 人设绑定：服务者名片从 responders 注册表解析（Bot 接单显示真实人设
  // 昵称/信用；未注册响应者回落既有 responderId 后四位兜底，零回归）。
  const activeResponderCap = activeClaim
    ? responders.find((r) => r.id === activeClaim.responderId)
    : undefined;
  const provider = {
    avatar:
      (activeClaim && personaAvatarForBot(activeClaim.responderId)) ?? "🧑‍🔧",
    name: activeResponderCap
      ? `服务者 · ${activeResponderCap.nickname}`
      : `服务者 · ${(activeClaim?.responderId ?? "待接单").slice(-4)}`,
    verified: activeResponderCap ? activeResponderCap.verified !== false : true,
    trustScore: activeResponderCap?.rating
      ? Math.round(activeResponderCap.rating * 20)
      : 88,
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
        ammo={ammoDef}
        capsule={{
          isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
          distanceMeters: scenario === "meetup" ? 500 : scenario === "companion" ? 300 : undefined,
          // P0 接电：SOS 一键报警 → 危机应急预案（级别 3 极端紧急，EPA 三通道通知）
          onSosClick: () => {
            raiseCrisis({ level: 3, note: "履约座舱 SOS 一键报警（紧急求助）", waveId: wave.id, contacts: [] });
            toast("🚨 SOS 已上报 · 已通知紧急联系人/平台值班/警方通道", "success");
          },
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
        dynamic={{
          ammo: ammoDef,
          bizParams,
          evidencePhotos: {
            before: evidencePhotos[0]?.photo ?? null,
            after: evidencePhotos[1]?.photo ?? null,
          },
          onUploadProof: (phaseKey) => {
            toast(
              `📷 ${phaseKey === "before" ? "Before" : "After"} 拍照打卡已提交 · 水印相机时空存证`,
              "success",
            );
          },
          onActionClick: (actionKey) => {
            if (actionKey === "dispute") setDisputeOpen(true);
          },
        }}
        onDial={() => setDialOpen(true)}
        onChat={() => {
          toast("💬 隐私聊天已开启 · 双方脱敏直连（虚拟号保护）", "success");
        }}
        onComplete={() => void handleComplete()}
        customRequirements={wave.customRequirements}
        forceArmed={safety?.safetyLevel === "PROXIMITY_ENHANCED"}
        safetyBadge={safety?.safetyBadge}
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

      {/* P0 接电：📞 一键虚拟通话弹层（Deterministic 一次性线路，30min 失效） */}
      {dialOpen && (
        <div className="fc-call-mask" data-testid="dial-overlay">
          <div className="glass-panel rounded-3xl p-4 w-[320px] max-w-[92vw]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-white/85">
                📞 一键虚拟通话
              </span>
              <button
                type="button"
                aria-label="关闭虚拟通话"
                onClick={() => setDialOpen(false)}
                className="text-white/40 hover:text-white text-[13px]"
              >
                ✕
              </button>
            </div>
            <DialCard
              waveId={wave.id}
              responderId={activeClaim?.responderId ?? "unknown"}
              demanderId={wave.authorId}
              lockedAt={wave.createdAt}
            />
          </div>
        </div>
      )}

      {/* W7：争议调解半屏抽屉（P1：动态物证链 + 动态三级仲裁金额） */}
      <ArbitrationSheet
        open={disputeOpen}
        orderId={wave.id}
        ammoId={ammoDef.ammoId}
        currentState={currentState}
        evidence={dEvidence}
        proposal={dProposal}
        disputeAmountYuan={disputeAmount}
        onAcceptProposal={() => void handleAcceptProposal()}
        onEscalateManual={handleEscalateManual}
        onClose={() => setDisputeOpen(false)}
      />
    </div>
  );
}

/**
 * P1：动态争议物证链装配（确定性规则，红线 1 —— AI 仅存在于 L2 Advisory）。
 * 从当前活动 Wave 的真实数据派生：品类 + 金额 + 需求诉求（negotiableNote）+ 已上传存证照片。
 */
export function buildDisputeEvidence(
  wave: {
    basics: { category: string; time: string; area: string };
    budget: number;
    payAmount?: number;
    negotiableNote?: string;
    customs?: { text: string }[];
  },
  evidencePhotos: ArbitrationPhotoEvidence[] = [],
): ArbitrationEvidence {
  const category = wave.basics.category;
  const amount = wave.payAmount ?? wave.budget;
  const complaint = wave.negotiableNote?.trim()
    ? `${category} 履约争议：${wave.negotiableNote.trim()}`
    : `${category} 履约争议（订单金额 ¥${amount}）`;
  const anchor = `需求约定 | ${wave.basics.time} · ${wave.basics.area} · 预算 ¥${wave.budget}`;
  return {
    complaint,
    photos: evidencePhotos,
    chatTranscript:
      wave.customs && wave.customs.length > 0
        ? [anchor, `验收标准 | ${wave.customs.slice(0, 3).map((c) => c.text).join("；")}`]
        : [anchor],
  };
}

/**
 * P1：三级仲裁金额动态推导（确定性比例规则，红线 1）。
 * 退款按订单金额比例折算，金额本身驱动 ArbitrationSheet 的 LEVEL_1/2/3 分流。
 */
export function buildDisputeProposal(
  amountYuan: number,
  evidencePhotoCount = 0,
): ArbitrationProposal {
  const safeAmount = Number.isFinite(amountYuan) && amountYuan > 0 ? amountYuan : 0;
  // 小额（≤30）全额退还；其余按 30% 折算（最小 30 元），保证 L1 秒赔与 L2 建议的确定性分档
  const refundAmount =
    safeAmount <= 30 ? safeAmount : Math.max(30, Math.round(safeAmount * 0.3));
  const refundPct = safeAmount > 0 ? Math.round((refundAmount / safeAmount) * 100) : 0;
  return {
    liability: "split",
    liabilityNote:
      safeAmount <= 0
        ? "订单金额未录入，按双方陈述折衷认定"
        : `订单金额 ¥${safeAmount}${evidencePhotoCount > 0 ? `，已上传 ${evidencePhotoCount} 张水印存证照片` : ""}，按履约瑕疵比例折算`,
    refundAmount,
    compensationCouponYuan: Math.max(10, Math.min(20, Math.round(safeAmount * 0.1))),
    creditDeduct: 10,
    reasonChain: [
      `规则 R-1：争议金额 ¥${safeAmount} 已进入三级仲裁分流（订单资金处托管冻结）`,
      `规则 R-2：按 ${refundPct}% 瑕疵比例折算退款 ¥${refundAmount}`,
      evidencePhotoCount > 0
        ? `规则 R-3：已上传 ${evidencePhotoCount} 张水印存证照片（SHA-256 指纹）纳入证据比对`
        : "规则 R-3：暂无存证照片，以需求约定与聊天锚点评估",
    ],
  };
}
