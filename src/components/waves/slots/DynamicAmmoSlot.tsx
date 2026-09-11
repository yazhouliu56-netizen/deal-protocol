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
import DuoButton from "@/components/ui/DuoButton";
import DuoPill, { type DuoPillTone } from "@/components/ui/DuoPill";

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
 * 自包含（外骨骼零改动，差异全收敛插槽区，红线 2）。
 *
 * Duo 化（Batch① 2026-09）：暗岛 SLOT_CSS 删除，白底 Duo 卡 + polar 参数行 +
 * DuoPill 徽章群（引信/定制/鉴真）；`dyn-slot`/`dyn-*` 首类名与 data-* 锚点保留
 * （单测 `class="dyn-param` 前缀 + cockpit-battle4 data 面全绿）。
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

/** Duo 白底卡（`dyn-slot` 首类名保留作身份钩）+ polar 参数行。 */
const SLOT_CARD =
  "dyn-slot flex flex-col gap-2.5 p-3.5 rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] border-b-[5px] text-sm leading-relaxed text-[var(--color-duo-eel)] shadow-sm";
const PARAM_ROW =
  "dyn-param flex items-center gap-2 text-[13px] px-2.5 py-2 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)]";
const PARAM_ICON =
  "dyn-param-icon w-7 h-7 rounded-lg flex items-center justify-center text-[15px] shrink-0 bg-white border-2 border-[var(--color-duo-swan)]";
const SECTION_POLAR =
  "flex flex-col gap-1.5 p-2.5 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)]";
const PHOTO_CELL =
  "relative aspect-[4/3] rounded-xl border-2 border-dashed border-[var(--color-duo-swan)] bg-[var(--color-duo-polar)] flex flex-col items-center justify-center gap-1.5 text-xs font-bold text-[var(--color-duo-wolf)] overflow-hidden";

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

function forgeryTone(level: string): DuoPillTone {
  switch (level) {
    case "MEDIUM":
      return "yellow";
    case "HIGH":
      return "orange";
    case "CRITICAL":
      return "red";
    case "LOW":
    default:
      return "green";
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
    <div className={`${SLOT_CARD} ${themeClass}`} data-slot="dynamic-ammo" data-theme={normalizeAmmoTheme(ammo.holographic?.theme)}>
      <h4 className="m-0 mb-1 text-[15px] font-extrabold text-[var(--color-duo-eel)]">⚙️ 动态履约 · {ammo.category}</h4>
      <div className="text-xs font-bold text-[var(--color-duo-wolf)]">
        {ammo.ammoId} · v{ammo.version}
      </div>

      {customTags.length > 0 && (
        <section className={`${SECTION_POLAR} flex-row flex-wrap`} data-testid="dyn-custom-requirements" data-custom-requirements>
          {customTags.map((tag) => (
            <DuoPill key={tag} tone="blue" variant="soft" data-custom-tag>
              {tag}
            </DuoPill>
          ))}
        </section>
      )}

      <section className={SECTION_POLAR} data-testid="dyn-params">
        {paramRows.length > 0 ? (
          paramRows.map((row) => (
            <div key={row.key} className={PARAM_ROW} data-param={row.key}>
              <span className={PARAM_ICON} data-param-icon aria-hidden="true">
                {paramIconOf(row.key)}
              </span>
              <b className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-[var(--color-duo-eel)]">{row.key}</b>
              <span className="text-right font-bold text-[var(--color-duo-eel)] break-all">{row.display}</span>
            </div>
          ))
        ) : (
          <div className={PARAM_ROW} data-empty-params>
            <span className={PARAM_ICON} aria-hidden="true">⚙️</span>
            <b className="flex-1 text-[13px] font-bold text-[var(--color-duo-eel)]">自定义参数</b>
            <span className="font-bold text-[var(--color-duo-wolf)]">未固化</span>
          </div>
        )}
      </section>

      {needsCamera && (
        <section className="grid grid-cols-2 gap-2" data-testid="dyn-proof">
          <div className={PHOTO_CELL} data-photo="before">
            {beforeDisplay ? (
              <>
                <Image src={beforeDisplay} alt="存证 Before 照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
                {beforeResult && (
                  <DuoPill
                    tone={forgeryTone(beforeResult.forgeryReport.riskLevel)}
                    variant="solid"
                    testId="dyn-before-forgery"
                    className="absolute bottom-1.5 left-1.5 right-1.5 justify-center"
                  >
                    🔬 {Math.round(beforeResult.forgeryReport.overallConfidence * 100)}% · {beforeResult.forgeryReport.riskLevel}
                  </DuoPill>
                )}
              </>
            ) : (
              <>
                <span>📷 Before 待拍摄</span>
                <DuoButton variant="secondary" size="sm" sound="click" data-action="proof-before" data-testid="proof-camera-trigger" onClick={() => openCapture("before")} className="rounded-2xl">
                  📸 拍照打卡
                </DuoButton>
              </>
            )}
          </div>
          <div className={PHOTO_CELL} data-photo="after">
            {afterDisplay ? (
              <>
                <Image src={afterDisplay} alt="存证 After 照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
                {afterResult && (
                  <DuoPill
                    tone={forgeryTone(afterResult.forgeryReport.riskLevel)}
                    variant="solid"
                    testId="dyn-after-forgery"
                    className="absolute bottom-1.5 left-1.5 right-1.5 justify-center"
                  >
                    🔬 {Math.round(afterResult.forgeryReport.overallConfidence * 100)}% · {afterResult.forgeryReport.riskLevel}
                  </DuoPill>
                )}
              </>
            ) : (
              <>
                <span>📷 After 待拍摄</span>
                <DuoButton variant="secondary" size="sm" sound="click" data-action="proof-after" data-testid="proof-camera-trigger" onClick={() => openCapture("after")} className="rounded-2xl">
                  📸 拍照打卡
                </DuoButton>
              </>
            )}
          </div>
        </section>
      )}
      {needsCamera && (
        <div data-testid="dyn-proof-status">
          {twinVerified ? (
            twinCritical ? (
              <span className="text-[12px] font-bold text-[var(--color-duo-red-dark)]">⚠️ 伪造拦截：CRITICAL 照片已被系统标记，请重拍真实照片</span>
            ) : (
              <span className="text-[12px] font-bold text-[var(--color-duo-green-ink)]">✅ 双拍验真已通过（水印相机存证 + 🔬 {beforeResult && afterResult ? `${Math.round(((beforeResult.forgeryReport.overallConfidence + afterResult.forgeryReport.overallConfidence)/2)*100)}%` : ""} 鉴真）</span>
            )
          ) : (
            <span className="text-[12px] text-[var(--color-duo-wolf)]">
              ⚠️ 完成 Before/After 双拍后按弹药契约核销（红线 4 零信任物理感知）
            </span>
          )}
        </div>
      )}
      {twinVerified && !twinCritical && beforeResult && afterResult && (
        <div className="flex flex-wrap gap-1.5 flex-col" data-testid="dyn-sha-chain">
          <DuoPill tone="neutral" variant="soft" className="font-mono !text-[11px] break-all">
            SHA-256 Before {beforeResult.sha256.slice(0, 12)}… · After {afterResult.sha256.slice(0, 12)}…
          </DuoPill>
        </div>
      )}

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="dyn-badges">
          {badges.map((badge) => (
            <DuoPill key={badge} tone="neutral" variant="soft">
              {badge}
            </DuoPill>
          ))}
        </div>
      )}

      <DuoButton
        variant="outline"
        size="md"
        sound="click"
        fullWidth
        data-action="dispute"
        data-testid="dispute-entry"
        onClick={() => onActionClick?.("dispute")}
        className="rounded-2xl"
      >
        ⚖️ 申请调解 / 申诉
      </DuoButton>

      {capturing && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="dyn-proof-modal" onClick={() => setCapturing(null)}>
          <div className="w-full max-w-[420px] max-h-[88vh] overflow-auto bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] rounded-3xl p-3.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <strong className="text-[13px] text-[var(--color-duo-eel)]">📷 {capturing === "before" ? "服务前" : "服务后"} 拍照存证 · 水印相机</strong>
              <button type="button" aria-label="关闭" onClick={() => setCapturing(null)} className="text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)] bg-none border-none text-sm cursor-pointer">✕</button>
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