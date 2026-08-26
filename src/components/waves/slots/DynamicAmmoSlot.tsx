"use client";

import Image from "next/image";
import { useState } from "react";
import type {
  IAmmoDefinition,
  ICockpitActionSchema,
  INormalizedCustomIntent,
} from "@/types/ammo-schema";
import type { IFuzePolicy } from "@/types/fuze-policy";
import type { ScenarioTheme } from "@/types/ui-viewport";
import ProofCamera, { type IProofCaptureResult } from "@/components/oto-ui/controls/ProofCamera";

/**
 * 长尾动态弹药通用履约插槽（Dynamic Ammo Slot · 自适应 theme-dynamic）。
 *
 * 非三大官方标杆（housekeeping / meetup / companion）之外的任意长尾/动态
 * 弹药（如 DRONE_CROP_SPRAY 农田植保热注册弹药）在此获得通用履约视口：
 * - 动态参数快照：订单固化 bizParams（亩数 / 农药类型 / 作物种类等）结构化展示；
 * - 存证打卡区：声明 WATERMARK_CAMERA 的弹药展示 Before/After 双拍位拍照打卡，
 *   集成 ProofCamera 全链（原生相机 ➔ 水印压制 ➔ SHA-256 ➔ 五信号快筛）；
 * - 安全引信徽标：fuzePolicy 投影（🛡️财产险 / ⏳预付冻结 / 📞虚拟号 / 📍围栏 / 🆘SOS）；
 * - 争议售后：标准【申请调解/申诉】入口。
 *
 * 视界理论（白皮书 §五 5.7 维度 5 + §十 D8）：弹药 8 维全息配置驱动，零品类
 * 硬编码；未声明任何特化位时安全回落本插槽（红线 2/4，严禁白屏）。
 * 自包含 CSS（外骨骼零改动，差异全收敛插槽区，红线 2）。
 */

export interface DynamicAmmoSlotProps {
  /** 目标弹药整弹（含 8 维全息镜像 holographic.formSchema / requiredSensors / theme）。 */
  ammo: IAmmoDefinition;
  /** 订单中固化的动态表单参数快照（如 { fieldAreaMu: 50, pesticideType: "除草剂" }）。 */
  bizParams?: Record<string, unknown>;
  /** Before/After 存证照片（验真徽标依据弹药传感声明）。 */
  evidencePhotos?: { before?: string | null; after?: string | null };
  /** 拍照打卡上传请求（携带相位键 "before" | "after"，由调用方完成真实上传；P0-3 全链新增第二参结构化载荷）。 */
  onUploadProof?: (phaseKey: string, result?: IProofCaptureResult) => void;
  /** 结构化存证回调（与 onUploadProof 同步触发，供履约证据链入账）。 */
  onProofCaptured?: (phaseKey: "before" | "after", result: IProofCaptureResult) => void;
  /** 插槽动作事件（"dispute" 申请调解/申诉等，由座舱上层接线）。 */
  onActionClick?: (actionKey: string) => void;
  /** 需求方定制要求（阶段3 语义驯化产物）：参数快照区渲染中性定制标签。 */
  customRequirements?: INormalizedCustomIntent;
  /** 关联订单号（水印订单哈希，P0-3 全链透传）。 */
  orderNo?: string;
  /** 当前 GPS（水印坐标，缺省占位）。 */
  geo?: { lat: number; lng: number; accuracyMeters?: number };
}

/** 引信策略 → 安全徽标（DynamicAmmoSlot 自有投影，对齐 describeSafetyBadges 语义的子集）。 */
export function describeFuzeBadges(fuze: IFuzePolicy): string[] {
  const badges: string[] = [];
  if (fuze.propertyInsurance) badges.push("🛡️财产险");
  if (fuze.deposit.strategy !== "NONE") badges.push("🔒定金托管");
  if (fuze.advanceFreeze.enabled) badges.push("⏳预付冻结");
  if (fuze.geoFence.enabled) badges.push(`📍LBS围栏${fuze.geoFence.radiusM ? ` ${fuze.geoFence.radiusM}m` : ""}`);
  if (fuze.privacy.virtualNumber) badges.push("📞虚拟号");
  if (fuze.sos.enabled) badges.push("🆘SOS联动");
  return badges;
}

/** 弹药声明的物理传感器清单（8 维镜像只读投影；缺省 = 纯软件履约）。 */
export function requiredSensorKinds(ammo: IAmmoDefinition): string[] {
  return ammo.holographic?.requiredSensors ?? [];
}

/** 弹药声明的水印相机是否需要（驱动 Before/After 打卡区渲染）。 */
export function requiresWatermarkCamera(ammo: IAmmoDefinition): boolean {
  return requiredSensorKinds(ammo).includes("WATERMARK_CAMERA");
}

/**
 * 弹药主题令牌归一（D-8 唯一权威归一点，供草稿卡/座舱/插槽三端统一消费）：
 * 白名单四枚业务主题 + `default` 直通；未知/缺失安全回落 `default`，严禁样式崩溃。
 */
export function normalizeAmmoTheme(value: unknown): ScenarioTheme {
  if (
    value === "housekeeping" ||
    value === "meetup" ||
    value === "companion" ||
    value === "tech"
  ) {
    return value;
  }
  return "default";
}

/** 弹药主题令牌 → 插槽主题类（缺省 default 安全回落）。 */
export function resolveSlotThemeClass(ammo: IAmmoDefinition): string {
  return `dyn-${normalizeAmmoTheme(ammo.holographic?.theme)}`;
}

/** 动态参数快照 → 展示行（标量直显、对象序列化、空值占位）。 */
export function describeBizParamRows(bizParams: Record<string, unknown> | undefined): { key: string; display: string }[] {
  if (!bizParams) return [];
  return Object.entries(bizParams).map(([key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return { key, display: String(value) };
    }
    if (value === null || value === undefined) return { key, display: "—" };
    try {
      return { key, display: JSON.stringify(value) };
    } catch {
      return { key, display: "—" };
    }
  });
}

/** 拟物参数图标映射（键名子串匹配，大小写不敏感；缺省 ⚙️ 兜底）。 */
const PARAM_ICON_RULES: Array<[string, string]> = [
  ["area", "🌾"],
  ["mu", "📐"],
  ["crop", "🌱"],
  ["plant", "🌿"],
  ["pesticide", "🧪"],
  ["fertilizer", "🧫"],
  ["drone", "🚁"],
  ["height", "📏"],
  ["model", "🔧"],
  ["brand", "🏭"],
  ["count", "🔢"],
  ["times", "🔁"],
  ["duration", "⏱"],
  ["hours", "⏱"],
  ["distance", "📏"],
  ["date", "📅"],
  ["time", "⏰"],
  ["address", "📍"],
  ["location", "📍"],
  ["amount", "💰"],
  ["price", "💰"],
  ["size", "📦"],
  ["level", "📶"],
  ["color", "🎨"],
  ["material", "🧱"],
  ["power", "⚡"],
  ["water", "💧"],
  ["type", "🏷"],
  ["remark", "📝"],
  ["note", "📝"],
  ["name", "🏷"],
];

/** 参数键 → 拟物图标（毛玻璃标签左置；无规则命中 → ⚙️）。 */
export function paramIconOf(key: string): string {
  const lower = key.toLowerCase();
  for (const [rule, icon] of PARAM_ICON_RULES) {
    if (lower.includes(rule)) return icon;
  }
  return "⚙️";
}

const SLOT_CSS = `
.dyn-slot{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;
  background:linear-gradient(135deg,var(--theme-surface-tint),rgba(123,97,255,.06));
  border:1px solid var(--theme-border);color:#e2e8f0;font-size:14px;line-height:1.5}
.dyn-slot h4{margin:0 0 6px;font-size:15px;font-weight:600;color:#67e8f9}
.dyn-meta{font-size:12px;color:rgba(255,255,255,.68);font-weight:500}
.dyn-params{display:flex;flex-direction:column;gap:6px;padding:10px 11px;border-radius:14px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12)}
.dyn-param{display:flex;align-items:center;gap:9px;font-size:13px;padding:8px 9px;border-radius:12px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);
  backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}
.dyn-param-icon{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;
  justify-content:center;font-size:15px;flex-shrink:0;
  background:linear-gradient(135deg,var(--theme-surface-tint),rgba(255,255,255,.08));
  border:1px solid var(--theme-border)}
.dyn-param b{color:#f1f5f9;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;font-size:13px;font-weight:600}
.dyn-param span{color:#cbd5e1;text-align:right;word-break:break-all;font-weight:600}
.dyn-photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dyn-photo{position:relative;aspect-ratio:4/3;border-radius:12px;border:1px dashed rgba(255,255,255,.25);
  display:flex;align-items:center;justify-content:center;font-size:12px;color:#cbd5e1;
  overflow:hidden;background:rgba(255,255,255,.05);flex-direction:column;gap:6px;font-weight:500}
.dyn-photo img{width:100%;height:100%;object-fit:cover;border-radius:12px}
.dyn-photo-btn{min-height:44px;padding:8px 14px;border-radius:12px;border:none;font-size:13px;font-weight:800;
  cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--theme-primary),var(--theme-primary-active));
  box-shadow:0 6px 18px var(--theme-glow)}
.dyn-verified{font-size:12px;color:#4ade80;font-weight:600}
.dyn-badges{display:flex;flex-wrap:wrap;gap:6px}
.dyn-badge{font-size:12px;font-weight:500;padding:4px 10px;border-radius:999px;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#dbe4f0}
.dyn-dispute{width:100%;min-height:44px;padding:9px 0;border-radius:12px;
  border:1px solid rgba(251,191,36,.4);background:rgba(251,191,36,.08);
  color:#fbbf24;font-size:14px;font-weight:700;cursor:pointer}
.dyn-custom{display:flex;flex-wrap:wrap;gap:6px;padding:8px 11px;border-radius:12px;
  background:rgba(123,97,255,.1);border:1px solid rgba(123,97,255,.3)}
.dyn-custom-tag{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;
  background:rgba(123,97,255,.16);border:1px solid rgba(123,97,255,.4);color:#c4b5fd}
.dyn-proof-modal{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;padding:16px}
.dyn-proof-sheet{width:100%;max-width:420px;max-height:88vh;overflow:auto;background:linear-gradient(160deg,#0f172a,#1e293b);
  border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:14px}
.dyn-forgery{font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;border:1px solid;display:inline-flex;align-items:center;gap:4px}
.dyn-forgery-low{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.35);color:#86efac}
.dyn-forgery-medium{background:rgba(251,191,36,.14);border-color:rgba(251,191,36,.4);color:#fde68a}
.dyn-forgery-high{background:rgba(249,115,22,.14);border-color:rgba(249,115,22,.4);color:#fed7aa}
.dyn-forgery-critical{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.5);color:#fecaca}
`;

/** 长尾动态弹药通用履约插槽：参数快照 + 存证打卡 + 引信徽标 + 申诉入口。 */
const DRESS_LABEL_DYN: Record<string, string> = {
  THEMED_MAID: "女仆主题",
  THEMED_COSPLAY: "角色扮演/制服",
  FORMAL_UNIFORM: "正装/礼服",
  CUSTOM: "指定着装",
};

/** 定制契约 → 参数快照区中性标签（结构化投影，杜绝原始粗糙词直显）。 */
export function describeDynamicCustomTags(
  custom?: INormalizedCustomIntent,
): string[] {
  if (!custom) return [];
  const tags: string[] = [];
  if (custom.dressCode?.required) {
    tags.push(`[工作着装: ${DRESS_LABEL_DYN[custom.dressCode.type] ?? "指定着装"}]`);
  }
  if (custom.ageRange) {
    tags.push(`[期望年龄: ${custom.ageRange[0]}-${custom.ageRange[1]}岁]`);
  }
  if (custom.genderPreference && custom.genderPreference !== "ANY") {
    tags.push(`[性别偏好: ${custom.genderPreference === "FEMALE" ? "女性" : "男性"}]`);
  }
  return tags;
}

function forgeryClass(level: string): string {
  switch (level) {
    case "LOW":
      return "dyn-forgery-low";
    case "MEDIUM":
      return "dyn-forgery-medium";
    case "HIGH":
      return "dyn-forgery-high";
    case "CRITICAL":
      return "dyn-forgery-critical";
    default:
      return "dyn-forgery-low";
  }
}

export default function DynamicAmmoSlot({
  ammo,
  bizParams,
  evidencePhotos,
  onUploadProof,
  onProofCaptured,
  onActionClick,
  customRequirements,
  orderNo,
  geo,
}: DynamicAmmoSlotProps) {
  const needsCamera = requiresWatermarkCamera(ammo);
  const badges = describeFuzeBadges(ammo.fuzePolicy);
  const paramRows = describeBizParamRows(bizParams);
  const themeClass = resolveSlotThemeClass(ammo);
  const [capturing, setCapturing] = useState<"before" | "after" | null>(null);
  // 拍照存证单号：开启拍照的事件回调里生成（render 期禁止 Date.now，React Compiler purity）。
  const [captureNo, setCaptureNo] = useState<string | null>(null);
  const openCapture = (phase: "before" | "after") => {
    setCapturing(phase);
    setCaptureNo(orderNo ?? `dyn-${phase}-${Date.now().toString(36)}`);
  };
  const [beforeResult, setBeforeResult] = useState<IProofCaptureResult | null>(null);
  const [afterResult, setAfterResult] = useState<IProofCaptureResult | null>(null);

  const beforeDisplay = beforeResult?.dataUrl ?? evidencePhotos?.before ?? null;
  const afterDisplay = afterResult?.dataUrl ?? evidencePhotos?.after ?? null;
  const twinVerified = Boolean(beforeDisplay && afterDisplay);
  const twinCritical = beforeResult?.forgeryReport.riskLevel === "CRITICAL" || afterResult?.forgeryReport.riskLevel === "CRITICAL";
  const customTags = describeDynamicCustomTags(customRequirements);

  const handleCaptured = (phase: "before" | "after", result: IProofCaptureResult) => {
    if (phase === "before") setBeforeResult(result);
    else setAfterResult(result);
    onUploadProof?.(phase, result);
    onProofCaptured?.(phase, result);
    setCapturing(null);
  };

  return (
    <div className={`dyn-slot ${themeClass}`} data-slot="dynamic-ammo" data-theme={normalizeAmmoTheme(ammo.holographic?.theme)}>
      <style>{SLOT_CSS}</style>
      <h4>⚙️ 动态履约 · {ammo.category}</h4>
      <div className="dyn-meta">
        {ammo.ammoId} · v{ammo.version}
      </div>

      {customTags.length > 0 && (
        <section className="dyn-custom" data-testid="dyn-custom-requirements" data-custom-requirements>
          {customTags.map((tag) => (
            <span key={tag} className="dyn-custom-tag" data-custom-tag>
              {tag}
            </span>
          ))}
        </section>
      )}

      <section className="dyn-params" data-testid="dyn-params">
        {paramRows.length > 0 ? (
          paramRows.map((row) => (
            <div key={row.key} className="dyn-param" data-param={row.key}>
              <span className="dyn-param-icon" data-param-icon aria-hidden="true">
                {paramIconOf(row.key)}
              </span>
              <b>{row.key}</b>
              <span>{row.display}</span>
            </div>
          ))
        ) : (
          <div className="dyn-param" data-empty-params>
            <span className="dyn-param-icon" aria-hidden="true">⚙️</span>
            <b>自定义参数</b>
            <span>未固化</span>
          </div>
        )}
      </section>

      {needsCamera && (
        <section className="dyn-photos" data-testid="dyn-proof">
          <div className="dyn-photo" data-photo="before">
            {beforeDisplay ? (
              <>
                <Image src={beforeDisplay} alt="存证 Before 照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
                {beforeResult && (
                  <span className={`dyn-forgery ${forgeryClass(beforeResult.forgeryReport.riskLevel)}`} style={{ position: "absolute", bottom: 6, left: 6, right: 6, textAlign: "center" }} data-testid="dyn-before-forgery">
                    🔬 {Math.round(beforeResult.forgeryReport.overallConfidence * 100)}% · {beforeResult.forgeryReport.riskLevel}
                  </span>
                )}
              </>
            ) : (
              <>
                <span>📷 Before 待拍摄</span>
                <button type="button" className="dyn-photo-btn" data-action="proof-before" onClick={() => openCapture("before")}>
                  拍照打卡
                </button>
              </>
            )}
          </div>
          <div className="dyn-photo" data-photo="after">
            {afterDisplay ? (
              <>
                <Image src={afterDisplay} alt="存证 After 照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
                {afterResult && (
                  <span className={`dyn-forgery ${forgeryClass(afterResult.forgeryReport.riskLevel)}`} style={{ position: "absolute", bottom: 6, left: 6, right: 6, textAlign: "center" }} data-testid="dyn-after-forgery">
                    🔬 {Math.round(afterResult.forgeryReport.overallConfidence * 100)}% · {afterResult.forgeryReport.riskLevel}
                  </span>
                )}
              </>
            ) : (
              <>
                <span>📷 After 待拍摄</span>
                <button type="button" className="dyn-photo-btn" data-action="proof-after" onClick={() => openCapture("after")}>
                  拍照打卡
                </button>
              </>
            )}
          </div>
        </section>
      )}
      {needsCamera && (
        <div data-testid="dyn-proof-status">
          {twinVerified ? (
            twinCritical ? (
              <span style={{ fontSize: 12, color: "#fca5a5", fontWeight: 700 }}>⚠️ 伪造拦截：CRITICAL 照片已被系统标记，请重拍真实照片</span>
            ) : (
              <span className="dyn-verified">✅ 双拍验真已通过（水印相机存证 + 🔬 {beforeResult && afterResult ? `${Math.round(((beforeResult.forgeryReport.overallConfidence + afterResult.forgeryReport.overallConfidence)/2)*100)}%` : ""} 鉴真）</span>
            )
          ) : (
            <span style={{ fontSize: 12, color: "#cbd5e1" }}>
              ⚠️ 完成 Before/After 双拍后按弹药契约核销（红线 4 零信任物理感知）
            </span>
          )}
        </div>
      )}
      {twinVerified && !twinCritical && beforeResult && afterResult && (
        <div className="dyn-badges" data-testid="dyn-sha-chain" style={{ flexDirection: "column" }}>
          <span className="dyn-badge" style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, wordBreak: "break-all" }}>
            SHA-256 Before {beforeResult.sha256.slice(0, 12)}… · After {afterResult.sha256.slice(0, 12)}…
          </span>
        </div>
      )}

      {badges.length > 0 && (
        <div className="dyn-badges" data-testid="dyn-badges">
          {badges.map((badge) => (
            <span key={badge} className="dyn-badge">
              {badge}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className="dyn-dispute"
        data-action="dispute"
        onClick={() => onActionClick?.("dispute")}
      >
        ⚖️ 申请调解 / 申诉
      </button>

      {capturing && (
        <div className="dyn-proof-modal" data-testid="dyn-proof-modal" onClick={() => setCapturing(null)}>
          <div className="dyn-proof-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 13, color: "#e2e8f0" }}>📷 {capturing === "before" ? "服务前" : "服务后"} 拍照存证 · 水印相机</strong>
              <button type="button" aria-label="关闭" onClick={() => setCapturing(null)} style={{ color: "#94a3b8", background: "none", border: "none", fontSize: 14, cursor: "pointer" }}>✕</button>
            </div>
            <ProofCamera
              orderNo={captureNo ?? `dyn-${capturing}`}
              geo={geo}
              onCaptured={(result) => handleCaptured(capturing, result)}
            />
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
 * 战役 4 · 履约座舱插槽宿主层（DynamicAmmoSlot 唯一正轨化）
 *
 * CockpitAmmoSlot 是座舱插槽区的唯一装配入口：
 * - variant="dyn"（长尾动态弹）→ 本体 DynamicAmmoSlot 全功能渲染，六原子
 *   行动模块按 D9 actionSchema / 传感·引信·计价声明自动推导装配；
 * - variant="hk"|"mt"|"cp"（官方标杆弹）→ 预置模板皮肤注册表分派，DOM
 *   锚点层级与交互文案与历史视口逐字守恒（零漂移铁律）。
 * 座舱（FulfillmentCockpit）仅消费本调度器，零品类分支。
 * ═══════════════════════════════════════════════════════════════════ */

import HousekeepingSlot from "./HousekeepingSlot";
import MeetupSlot from "./MeetupSlot";
import CompanionSlot from "./CompanionSlot";

/** 座舱插槽统一行动载荷（六模块数据与回调的全集，按 variant 取用）。 */
export interface CockpitSlotActions {
  /* ONSITE_QUOTE（hk） */
  quote?: { item: string; amountYuan: number; confirmed: boolean };
  baseAmountYuan?: number;
  maxSurchargeRatio?: number;
  onAcceptQuote?: () => void;
  onRejectQuote?: () => void;
  onClaimDamage?: () => void;
  /* PROOF_PHOTO（通用） */
  photos?: { before: string | null; after: string | null };
  evidencePhotos?: { before?: string | null; after?: string | null };
  onUploadProof?: (phaseKey: string, result?: IProofCaptureResult) => void;
  onProofCaptured?: (phaseKey: "before" | "after", result: IProofCaptureResult) => void;
  orderNo?: string;
  geo?: { lat: number; lng: number; accuracyMeters?: number };
  /* GEOFENCE_ARRIVAL + AA_SPLIT（mt） */
  seats?: Array<{ id: string; name: string; arrived: boolean }>;
  fenceMeters?: number;
  onScanArrival?: () => void;
  split?: { entries: Array<{ party: string; deltaYuan: number }>; totalYuan: number };
  onConfirmSplit?: () => void;
  onDisputeNoShow?: () => void;
  /* PRIVACY_SHIELD + DEPARTURE_STOP（cp） */
  isPrivacyShieldArmed?: boolean;
  departureDistanceMeters?: number;
  onTriggerFakeCall?: () => void;
  onBlockUser?: () => void;
  /* 通用 */
  bizParams?: Record<string, unknown>;
  customRequirements?: INormalizedCustomIntent;
  onActionClick?: (actionKey: string) => void;
}

/**
 * D9 行动 Schema 自动推导（弹药未显式声明 actionSchema 时的缺省装配）：
 * 传感/钩子/计价/引信声明 → 原子行动模块。存量弹零回归。
 */
export function deriveActionSchema(ammo: IAmmoDefinition): ICockpitActionSchema {
  const holo = ammo.holographic;
  const sensors = holo?.requiredSensors ?? [];
  const hooks = holo?.forwardHooks ?? [];
  const modules: ICockpitActionSchema["modules"] = [];
  if (hooks.includes("OnsiteQuoteHook")) modules.push({ module: "ONSITE_QUOTE" });
  if (sensors.includes("WATERMARK_CAMERA") || hooks.includes("CleaningCheckHook")) {
    modules.push({ module: "PROOF_PHOTO" });
  }
  if (sensors.includes("GPS_GEOFENCE") && hooks.includes("ArrivalCheckHook")) {
    modules.push({ module: "GEOFENCE_ARRIVAL" });
  }
  if (hooks.includes("AASplitSettleHook") || ammo.pricingModel.kind === "PER_SEAT") {
    modules.push({ module: "AA_SPLIT" });
  }
  // 隐私盾：钩子声明直驱（近炸引信类目由弹药装填 PrivacyShieldHook 表达）
  if (hooks.includes("PrivacyShieldHook")) {
    modules.push({ module: "PRIVACY_SHIELD" });
    modules.push({ module: "DEPARTURE_STOP" });
  }
  return {
    variant: resolveCockpitVariant(ammo),
    modules,
  };
}

/** 视口模板皮肤解析：D9 显式声明优先，theme 白名单派生兜底。 */
export function resolveCockpitVariant(ammo: IAmmoDefinition): ICockpitActionSchema["variant"] {
  const declared = ammo.holographic?.actionSchema?.variant;
  if (declared) return declared;
  const theme = ammo.holographic?.theme;
  if (theme === "housekeeping") return "hk";
  if (theme === "meetup") return "mt";
  if (theme === "companion") return "cp";
  return "dyn";
}

/** 预置模板皮肤注册表（官方标杆弹的历史视口锚点 · 零漂移铁律）。 */
const COCKPIT_TEMPLATE_REGISTRY: Record<
  Exclude<ICockpitActionSchema["variant"], "dyn">,
  (props: CockpitSlotActions & { ammo: IAmmoDefinition }) => React.ReactNode
> = {
  hk: ({ customRequirements, ...a }) => (
    <HousekeepingSlot
      quote={a.quote}
      photos={a.photos}
      onAcceptQuote={a.onAcceptQuote}
      onRejectQuote={a.onRejectQuote}
      onClaimDamage={a.onClaimDamage}
      baseAmountYuan={a.baseAmountYuan ?? 0}
      maxSurchargeRatio={a.maxSurchargeRatio}
      customRequirements={customRequirements}
      orderNo={a.orderNo}
      geo={a.geo}
      onProofCaptured={a.onProofCaptured}
    />
  ),
  mt: ({ seats, fenceMeters, onScanArrival, split, onConfirmSplit, onDisputeNoShow }) => (
    <MeetupSlot
      seats={seats ?? []}
      fenceMeters={fenceMeters}
      onScanArrival={onScanArrival}
      split={split}
      onConfirmSplit={onConfirmSplit}
      onDisputeNoShow={onDisputeNoShow}
    />
  ),
  cp: ({ isPrivacyShieldArmed, departureDistanceMeters, onTriggerFakeCall, onBlockUser }) => (
    <CompanionSlot
      isPrivacyShieldArmed={isPrivacyShieldArmed ?? true}
      departureDistanceMeters={departureDistanceMeters}
      onTriggerFakeCall={onTriggerFakeCall}
      onBlockUser={onBlockUser}
    />
  ),
};

/**
 * 座舱插槽区唯一装配入口：D9 行动 Schema 驱动的动态视口归一。
 * 用法：<CockpitAmmoSlot ammo={ammo} actions={{ quote, seats, ... }} />
 */
export function CockpitAmmoSlot({
  ammo,
  actions,
}: {
  ammo: IAmmoDefinition;
  actions?: CockpitSlotActions;
}) {
  const a: CockpitSlotActions = actions ?? {};
  const schema = ammo.holographic?.actionSchema ?? deriveActionSchema(ammo);
  if (schema.variant !== "dyn") {
    const template = COCKPIT_TEMPLATE_REGISTRY[schema.variant];
    if (template) return <>{template({ ammo, ...a })}</>;
  }
  return (
    <DynamicAmmoSlot
      ammo={ammo}
      bizParams={a.bizParams}
      evidencePhotos={a.evidencePhotos}
      onUploadProof={a.onUploadProof}
      onProofCaptured={a.onProofCaptured}
      onActionClick={a.onActionClick}
      customRequirements={a.customRequirements}
      orderNo={a.orderNo}
      geo={a.geo}
    />
  );
}