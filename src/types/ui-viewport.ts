/**
 * UI/UX 全景系统架构 · 视口与插槽契约（Viewport & Slot Contracts）。
 *
 * 人类创始人注入（2026-08-15）：
 * - 白皮书 §五 5.5「4 层体系与 5 态镜像视口标准」的代码投影；
 * - 第一层 设计令牌与微氛围层（ScenarioTheme 三大场景微主色）；
 * - 第二层 全局通用交互骨架层（状态胶囊 / 人格坞 / Copilot Orb / 安全护栏）；
 * - 第三层 动态视图与插槽渲染层（ViewportStage 与 AtomicFiveState 五态一一镜像）；
 * - 第四层 极端场景与无障碍容灾层（弱网提示 / 适老模式 / 防暴力伪装计算器）。
 *
 * 本文件为底层协议（红线 3：`UI / Ammo ➔ base ➔ types`），纯类型零业务依赖；
 * 视口渲染由 `IAmmoDefinition`（src/types/ammo-schema.ts）+ 本契约共同驱动
 * （宪法红线：禁止为单一品类硬编码独立全套页面，一切业务经动态视口装载）。
 */

/**
 * 场景特化微主色令牌（第一层 · 设计令牌与微氛围层）：
 * `housekeeping` 家政专业蓝 / `meetup` 组局活力橙 / `companion` 交友夜幕紫 /
 * `default` 全局通用兜底。
 */
export type ScenarioTheme = "housekeeping" | "meetup" | "companion" | "default";

/**
 * 五态镜像视口阶段（第三层 · 动态视图与插槽渲染层）：
 * 与 `AtomicFiveState`（PUBLISHED/MATCHED/IN_SERVICE/INSPECTED/SETTLED）一一镜像，
 * 底座状态推进到哪一态，视口即切换为对应镜像视口。
 */
export type ViewportStage =
  | "DRAFTING" // ← PUBLISHED   需求发布视口
  | "MATCHING" // ← MATCHED     撮合与匹配视口
  | "FULFILLMENT" // ← IN_SERVICE  履约时空视口
  | "INSPECTION" // ← INSPECTED   验收与对账视口
  | "SETTLEMENT"; // ← SETTLED    结算与信用视口

/** 五态 → 视口镜像映射（唯一标准，视口层消费方统一引用）。 */
export const VIEWPORT_STAGE_BY_STATE = {
  PUBLISHED: "DRAFTING",
  MATCHED: "MATCHING",
  IN_SERVICE: "FULFILLMENT",
  INSPECTED: "INSPECTION",
  SETTLED: "SETTLEMENT",
} as const;

/** 视口中文名（UI 文案与文档口径统一）。 */
export const VIEWPORT_STAGE_LABEL: Record<ViewportStage, string> = {
  DRAFTING: "需求发布",
  MATCHING: "撮合匹配",
  FULFILLMENT: "履约时空",
  INSPECTION: "验收对账",
  SETTLEMENT: "结算信用",
};

/** 多重人格角色（第二层 · 全局多重人格坞）。 */
export type PersonaRole = "employer" | "provider" | "organizer";

/* =====================================================================
 * 第二层：全局通用交互骨架（Universal Shell Framework）State 契约
 * ===================================================================== */

/** 顶部灵动状态胶囊：五态同步 + 弱网离线预警 + LBS 指示。 */
export interface IStatusCapsuleState {
  /** 当前五态（由 toAtomicFiveState 投影，null = 尚无单/未进入任何态）。 */
  state: "PUBLISHED" | "MATCHED" | "IN_SERVICE" | "INSPECTED" | "SETTLED" | null;
  /** 弱网离线预警（宪法 #10：降级是设计的一部分）。 */
  offline: boolean;
  /** LBS 定位指示：false = 演示坐标/未授权（ADR-0015 N16 按需授权）。 */
  lbsReady: boolean;
}

/** 全局多重人格坞：雇主 / 服务商 / 组局者单手极速切换（法则三）。 */
export interface IPersonaDockState {
  active: PersonaRole;
  available: PersonaRole[];
}

/** 悬浮智能中枢：语音转单入口 + 智能小法官直达（法则四 / L3-M3）。 */
export interface ICopilotOrbState {
  /** 语音转单入口是否可用（VoiceBar 管道就绪）。 */
  voiceReady: boolean;
  /** 智能小法官直达入口是否可开（争议裁决通道）。 */
  judgeAccessible: boolean;
}

/** 全局底线防护栏：一键红色 SOS + 隐私行程分享（法则五 / L4-M4）。 */
export interface ISafetyGuardState {
  /** SOS 一键拉起链路是否武装（紧急联系人 + 位置上报）。 */
  sosArmed: boolean;
  /** 隐私行程分享（脱敏位置共享，宪法 #8）。 */
  tripSharingEnabled: boolean;
}

/* =====================================================================
 * 第三层：动态视图与插槽渲染层（Dynamic Viewport & 5-State Slots）
 * ===================================================================== */

/** A. 需求发布视口插槽（PUBLISHED）：对话流草稿卡 + JSON-Schema 动态表单。 */
export interface IDraftingSlotProps {
  /** 弹药驱动：当前弹药 id（IAmmoDefinition.ammoId），视口按弹药切换微氛围。 */
  ammoId: string;
  /** 场景微主色令牌。 */
  theme: ScenarioTheme;
  /** 对话流拟物草稿卡（法则四：AI 意图转单产物，用户微调确认发射）。 */
  draftCard: {
    /** AI decompose 抽取出的需求摘要。 */
    summary: string;
    /** 草稿卡确认前是否可编辑。 */
    editable: boolean;
  };
  /** JSON-Schema 动态表单描述（承接 P1-5：弹药内嵌表单 schema）。 */
  schema: Record<string, unknown> | null;
}

/** B. 撮合与匹配视口插槽（MATCHED）：雷达波纹 + 抢单大厅 + 向量打分卡。 */
export interface IMatchingSlotProps {
  /** 雷达扫描波纹是否激活（广播可见性提示）。 */
  radarSweeping: boolean;
  /** 抢单大厅候补响应者数量。 */
  candidateCount: number;
  /** 向量打分卡（撮合综合分 0-100）。 */
  scoreCard: {
    score: number;
    dimensions: { label: string; value: number }[];
  };
}

/** C. 履约时空视口插槽（IN_SERVICE）：LBS 3D 轨迹 + 虚拟通信条 + 离线事务栏。 */
export interface IFulfillmentSlotProps {
  /** LBS 3D 轨迹图数据（SpatialHeatMap / MapLibre 渲染源）。 */
  trajectory: { lat: number; lng: number; at: number }[];
  /** 虚拟通信条（隐私号 / 私信 / 语音，L2-M5）。 */
  commBar: { virtualLineActive: boolean; imUnread: number };
  /** 离线事务栏（宪法 #10：弱网离线可离线入队）。 */
  offlineBar: { pendingOps: number; synced: boolean };
}

/** D. 验收与对账视口插槽（INSPECTED）：弹药特化插槽 + 物理核销。 */
export interface IInspectionSlotProps {
  /** 弹药特化插槽（同一视口按弹药切换，红线 2）：
   *  housekeeping → 前后照片比对 + 增项弹窗；meetup → AA 分摊滑块 + 到场核销；
   *  companion → 背调徽章。 */
  special: {
    /** 前后照片比对（保洁：完工 before/after 双拍证据）。 */
    photoCompare?: { before: string | null; after: string | null };
    /** AA 分摊滑块（组局：成本 → 人数 → 多退少补）。 */
    aaSplit?: { totalYuan: number; seats: number; perSeatYuan: number };
    /** 现场增项弹窗（保洁 OnsiteQuoteHook 的 UI 形态）。 */
    onsiteQuote?: { quoteYuan: number; confirmed: boolean };
  };
  /** 物理碰一碰 NFC 核销（法则五：完工碰一碰全屏水波纹动效）。 */
  nfcVerify: boolean;
  /** 动态码全屏核销（扫码降级路径，ScanMockSheet 同源）。 */
  dynamicCode: string | null;
}

/** E. 结算与信用视口插槽（SETTLED）：多方分账抽屉 + 六维雷达 + 跨场景积分。 */
export interface ISettlementSlotProps {
  /** 多方分账抽屉（AA 分账 / 违约金归守约方明细）。 */
  splitSheet: {
    entries: { party: string; yuan: number; kind: "pay" | "refund" | "penalty" }[];
    totalYuan: number;
  };
  /** 六维雷达打分板（守时/专业/礼貌/沟通/诚信/复购意愿）。 */
  radarScore: { label: string; value: number }[];
  /** 跨场景积分动效（信用飞轮：履约沉淀 → 跨弹药累积，宪法 #6）。 */
  creditGain: { points: number; tierUp: boolean };
}

/** 五态视口插槽聚合（视口层渲染器按 stage 分发消费）。 */
export interface IViewportSlots {
  stage: ViewportStage;
  drafting?: IDraftingSlotProps;
  matching?: IMatchingSlotProps;
  fulfillment?: IFulfillmentSlotProps;
  inspection?: IInspectionSlotProps;
  settlement?: ISettlementSlotProps;
}

/* =====================================================================
 * 第四层：极端场景与无障碍容灾交互（Edge-Cases & Accessibility）
 * ===================================================================== */

/** 弱网离线半透明提示条（宪法 #10 降级是设计的一部分）。 */
export interface IOfflineBannerState {
  visible: boolean;
  /** 离线队列未同步事务数。 */
  pending: number;
}

/** 大字/大触控区适老模式（5.5.1 适老化高对比排版引擎的 Token 级形态）。 */
export interface ISeniorModeTokens {
  /** 触控目标 ≥44px。 */
  touchTargetPx: number;
  /** 高对比度：正文对比度 ≥ 4.5:1。 */
  highContrast: boolean;
}

/** 🛡️ 防暴力伪装计算器界面（高危场景掩护形态，宪法 #8 极端物理防护）。 */
export interface IStealthCalculatorState {
  /** 是否处于伪装形态（标准计算器界面）。 */
  masked: boolean;
  /** 静默触发报警的特定数字组合（触发后不可见状态回流）。 */
  armCode: string | null;
  /** 静默音频回传通道是否武装。 */
  audioReportReady: boolean;
}
