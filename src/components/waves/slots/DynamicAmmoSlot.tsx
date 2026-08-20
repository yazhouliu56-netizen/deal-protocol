"use client";

import Image from "next/image";
import type { IAmmoDefinition, INormalizedCustomIntent } from "@/types/ammo-schema";
import type { IFuzePolicy } from "@/types/fuze-policy";
import type { ScenarioTheme } from "@/types/ui-viewport";

/**
 * 长尾动态弹药通用履约插槽（Dynamic Ammo Slot · 自适应 theme-dynamic）。
 *
 * 非三大官方标杆（housekeeping / meetup / companion）之外的任意长尾/动态
 * 弹药（如 DRONE_CROP_SPRAY 农田植保热注册弹药）在此获得通用履约视口：
 * - 动态参数快照：订单固化 bizParams（亩数 / 农药类型 / 作物种类等）结构化展示；
 * - 存证打卡区：声明 WATERMARK_CAMERA 的弹药展示 Before/After 双拍位拍照打卡；
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
  /** 拍照打卡上传请求（携带相位键 "before" | "after"，由调用方完成真实上传）。 */
  onUploadProof?: (phaseKey: string) => void;
  /** 插槽动作事件（"dispute" 申请调解/申诉等，由座舱上层接线）。 */
  onActionClick?: (actionKey: string) => void;
  /** 需求方定制要求（阶段3 语义驯化产物）：参数快照区渲染中性定制标签。 */
  customRequirements?: INormalizedCustomIntent;
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
  border:1px solid var(--theme-border);color:#e2e8f0;font-size:13px}
.dyn-slot h4{margin:0 0 6px;font-size:14px;color:#67e8f9}
.dyn-meta{font-size:11px;color:#94a3b8}
.dyn-params{display:flex;flex-direction:column;gap:6px;padding:10px 11px;border-radius:14px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12)}
.dyn-param{display:flex;align-items:center;gap:9px;font-size:12px;padding:8px 9px;border-radius:12px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);
  backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}
.dyn-param-icon{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;
  justify-content:center;font-size:15px;flex-shrink:0;
  background:linear-gradient(135deg,var(--theme-surface-tint),rgba(255,255,255,.08));
  border:1px solid var(--theme-border)}
.dyn-param b{color:#e2e8f0;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;font-size:11.5px}
.dyn-param span{color:#94a3b8;text-align:right;word-break:break-all;font-weight:600}
.dyn-photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dyn-photo{position:relative;aspect-ratio:4/3;border-radius:12px;border:1px dashed rgba(255,255,255,.25);
  display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8;
  overflow:hidden;background:rgba(255,255,255,.05);flex-direction:column;gap:6px}
.dyn-photo img{width:100%;height:100%;object-fit:cover;border-radius:12px}
.dyn-photo-btn{min-height:44px;padding:8px 14px;border-radius:12px;border:none;font-size:12px;font-weight:800;
  cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--theme-primary),var(--theme-primary-active));
  box-shadow:0 6px 18px var(--theme-glow)}
.dyn-verified{font-size:11px;color:#4ade80}
.dyn-badges{display:flex;flex-wrap:wrap;gap:6px}
.dyn-badge{font-size:11px;padding:3px 8px;border-radius:999px;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16)}
.dyn-dispute{width:100%;min-height:44px;padding:9px 0;border-radius:12px;
  border:1px solid rgba(251,191,36,.4);background:rgba(251,191,36,.08);
  color:#fbbf24;font-size:13px;font-weight:700;cursor:pointer}
.dyn-custom{display:flex;flex-wrap:wrap;gap:6px;padding:8px 11px;border-radius:12px;
  background:rgba(123,97,255,.1);border:1px solid rgba(123,97,255,.3)}
.dyn-custom-tag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;
  background:rgba(123,97,255,.16);border:1px solid rgba(123,97,255,.4);color:#c4b5fd}
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

export default function DynamicAmmoSlot({
  ammo,
  bizParams,
  evidencePhotos,
  onUploadProof,
  onActionClick,
  customRequirements,
}: DynamicAmmoSlotProps) {
  const needsCamera = requiresWatermarkCamera(ammo);
  const badges = describeFuzeBadges(ammo.fuzePolicy);
  const paramRows = describeBizParamRows(bizParams);
  const themeClass = resolveSlotThemeClass(ammo);
  const twinVerified = Boolean(evidencePhotos?.before && evidencePhotos?.after);
  const customTags = describeDynamicCustomTags(customRequirements);

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
          <div className="dyn-photo">
            {evidencePhotos?.before ? (
              <Image src={evidencePhotos.before} alt="存证 Before 照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
            ) : (
              <>
                <span>📷 Before 待拍摄</span>
                <button type="button" className="dyn-photo-btn" data-action="proof-before" onClick={() => onUploadProof?.("before")}>
                  拍照打卡
                </button>
              </>
            )}
          </div>
          <div className="dyn-photo">
            {evidencePhotos?.after ? (
              <Image src={evidencePhotos.after} alt="存证 After 照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
            ) : (
              <>
                <span>📷 After 待拍摄</span>
                <button type="button" className="dyn-photo-btn" data-action="proof-after" onClick={() => onUploadProof?.("after")}>
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
            <span className="dyn-verified">✅ 双拍验真已通过（水印相机存证）</span>
          ) : (
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              ⚠️ 完成 Before/After 双拍后按弹药契约核销（红线 4 零信任物理感知）
            </span>
          )}
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
    </div>
  );
}