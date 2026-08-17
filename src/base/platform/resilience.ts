/**
 * 优雅降级四部曲 + 数据湖/AB/哈希存证（ADR-0014，缺口 N13+N14）。
 * Part A: 降级链 degrades —— 长链路求值但绝不让整体任务失败。
 * Part B: 数据湖 + 哈希存证（append-only 事件流 + 内容哈希链防篡改/可校验）。
 * Part C: AB 平台最小集（双变体分流 + 判定）。
 * Part D: 多云多活五级容灾分流器（L6-M3）—— 纯确定性判定 + 全局运行时等级控制器
 *         （持久化经注入式适配器挂载，本文件零 Node 内建依赖，客户端/服务端均可消费）。
 */

// ---------- Part A: 优雅降级 ----------

export type DegradeStep<T> = { name: string; run: () => T | null };

/** 链式降级：依次尝试，第一个非 null 命中；全失败抛最后错误（但记录全链）。 */
export function degrades<T>(steps: DegradeStep<T>[], log: string[] = []): { value: T | null; log: string[] } {
  let lastErr: unknown = null;
  for (const s of steps) {
    try {
      const v = s.run();
      if (v !== null && v !== undefined) {
        log.push(`✓ ${s.name}`);
        return { value: v, log };
      }
      log.push(`✗ ${s.name}（无结果）`);
    } catch (e) {
      lastErr = e;
      log.push(`✗ ${s.name}（异常 ${String(e).slice(0, 60)}）`);
    }
  }
  log.push(`✗ 全部失败 ${lastErr ? `· ${String(lastErr).slice(0, 40)}` : ""}`);
  return { value: null, log };
}

// ---------- Part B: 数据湖 / 哈希存证 ----------

export interface LakeRecord {
  id: string;
  kind: string;
  at: number;
  payload: unknown;
  /** 内容哈希（djb2 家族），防篡改 + 可校验。 */
  hash: string;
  /** 前一条哈希（链式存证，防中间删改）。 */
  prev: string | null;
}

export function lakeHash(payload: unknown): string {
  let h = 5381;
  const s = JSON.stringify(payload);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return `h-${h.toString(16).padStart(8, "0")}`;
}

export function lakeAppend(
  lake: LakeRecord[],
  kind: string,
  payload: unknown,
  now: number
): LakeRecord[] {
  const prev = lake[lake.length - 1]?.hash ?? null;
  const rec: LakeRecord = {
    id: `l-${now.toString(36)}-${lake.length}`,
    kind,
    at: now,
    payload,
    hash: lakeHash(payload),
    prev,
  };
  return [...lake, rec];
}

/** 全链校验：每条的 prev 与上一条 hash 一致 + 自身 hash 与内容一致。返回是否可信。 */
export function lakeVerify(lake: LakeRecord[]): { ok: boolean; brokenAt: number | null } {
  for (let i = 0; i < lake.length; i++) {
    const r = lake[i];
    if (lakeHash(r.payload) !== r.hash) return { ok: false, brokenAt: i };
    if (i > 0 && r.prev !== lake[i - 1].hash) return { ok: false, brokenAt: i };
  }
  return { ok: true, brokenAt: null };
}

// ---------- Part C: AB 平台最小集 ----------

export interface AbVariant {
  id: string;
  label: string;
}

export function pickVariant(userId: string, variants: AbVariant[]): AbVariant {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) h = ((h << 5) + h + userId.charCodeAt(i)) >>> 0;
  return variants[h % variants.length];
}

export interface AbDecision {
  variantId: string;
  metric: number;
}

/** 获胜判定：变异体 A 指标均值显著高于 B（简化：差 > 阈值）。 */
export function abWinner(
  a: AbDecision[],
  b: AbDecision[],
  minDelta = 10
): { winner: "A" | "B" | "tie"; delta: number } {
  const mean = (xs: AbDecision[]) => (xs.length ? xs.reduce((s, x) => s + x.metric, 0) / xs.length : 0);
  const ma = mean(a);
  const mb = mean(b);
  const delta = ma - mb;
  if (delta > minDelta) return { winner: "A", delta };
  if (delta < -minDelta) return { winner: "B", delta: -delta };
  return { winner: "tie", delta: Math.abs(delta) };
}

// ---------- Part D: 多云多活五级容灾分流器（L6-M3）----------

/** 标准容灾等级：NORMAL ➔ 关非核心 ➔ 排队限流 ➔ 保核心 ➔ 全站只读。 */
export type DegradationLevel =
  | "NORMAL"
  | "DROP_NON_CORE"
  | "RATE_LIMIT_QUEUE"
  | "PRESERVE_CORE"
  | "READ_ONLY";

/** 系统动作类别：按动作性质归类，供网关拦截矩阵做确定性判定。 */
export type SystemActionCategory =
  | "CRITICAL_SOS"
  | "CORE_FULFILLMENT"
  | "NEW_DEMAND"
  | "NON_CORE_ANALYTICS"
  | "GENERAL_READ";

export interface DegradationDecision {
  isAllowed: boolean;
  /** 被阻断时返回的标准 HTTP 状态码（503 / 429）。 */
  httpStatus?: number;
  /** 机器可读错误码（X-…) 。 */
  errorCode?: string;
  /** 429 限流时的 Retry-After 秒数。 */
  retryAfterSeconds?: number;
}

export const DEGRADATION_LEVELS: readonly DegradationLevel[] = [
  "NORMAL",
  "DROP_NON_CORE",
  "RATE_LIMIT_QUEUE",
  "PRESERVE_CORE",
  "READ_ONLY",
];

const ALLOW: DegradationDecision = { isAllowed: true };

/** 五级 × 五类确定性拦截矩阵（红线 1：无任何概率分支）。 */
const DEGRADATION_MATRIX: Record<DegradationLevel, Record<SystemActionCategory, DegradationDecision>> = {
  NORMAL: {
    CRITICAL_SOS: ALLOW,
    CORE_FULFILLMENT: ALLOW,
    NEW_DEMAND: ALLOW,
    NON_CORE_ANALYTICS: ALLOW,
    GENERAL_READ: ALLOW,
  },
  DROP_NON_CORE: {
    CRITICAL_SOS: ALLOW,
    CORE_FULFILLMENT: ALLOW,
    NEW_DEMAND: ALLOW,
    NON_CORE_ANALYTICS: { isAllowed: false, httpStatus: 503, errorCode: "NON_CORE_SERVICES_DEGRADED" },
    GENERAL_READ: ALLOW,
  },
  RATE_LIMIT_QUEUE: {
    CRITICAL_SOS: ALLOW,
    CORE_FULFILLMENT: ALLOW,
    NEW_DEMAND: { isAllowed: false, httpStatus: 429, errorCode: "RATE_LIMITED_PLEASE_RETRY", retryAfterSeconds: 5 },
    NON_CORE_ANALYTICS: ALLOW,
    GENERAL_READ: ALLOW,
  },
  PRESERVE_CORE: {
    CRITICAL_SOS: ALLOW,
    CORE_FULFILLMENT: ALLOW,
    NEW_DEMAND: { isAllowed: false, httpStatus: 503, errorCode: "SYSTEM_PRESERVING_CORE_ONLY" },
    NON_CORE_ANALYTICS: { isAllowed: false, httpStatus: 503, errorCode: "SYSTEM_PRESERVING_CORE_ONLY" },
    GENERAL_READ: { isAllowed: false, httpStatus: 503, errorCode: "SYSTEM_PRESERVING_CORE_ONLY" },
  },
  READ_ONLY: {
    CRITICAL_SOS: ALLOW,
    CORE_FULFILLMENT: { isAllowed: false, httpStatus: 503, errorCode: "SYSTEM_READ_ONLY_MAINTENANCE" },
    NEW_DEMAND: { isAllowed: false, httpStatus: 503, errorCode: "SYSTEM_READ_ONLY_MAINTENANCE" },
    NON_CORE_ANALYTICS: { isAllowed: false, httpStatus: 503, errorCode: "SYSTEM_READ_ONLY_MAINTENANCE" },
    GENERAL_READ: ALLOW,
  },
};

export const DEGRADATION_ERROR_MESSAGES: Record<string, string> = {
  NON_CORE_SERVICES_DEGRADED: "非核心服务已降级，请稍后再试",
  RATE_LIMITED_PLEASE_RETRY: "请求过于频繁，已进入排队限流，请稍后重试",
  SYSTEM_PRESERVING_CORE_ONLY: "系统正在执行核心保活，仅放行一键 SOS 与在途履约",
  SYSTEM_READ_ONLY_MAINTENANCE: "系统全站只读维护中，仅放行一键 SOS",
};

/**
 * 纯函数判定器：给定容灾等级与动作类别，返回确定性放行/阻断决策。
 * 红线 1：纯确定性逻辑，无任何概率性代码；红线 3：无 UI/Store 依赖。
 */
export function evaluateDegradationGate(
  level: DegradationLevel,
  category: SystemActionCategory
): DegradationDecision {
  const row = DEGRADATION_MATRIX[level] ?? DEGRADATION_MATRIX.NORMAL;
  return row[category] ?? ALLOW;
}

/**
 * 路径分类器：把 API 路径归类到动作类别（确定性正则，无概率）。
 * - /api/sos/xxx                        ➔ CRITICAL_SOS（生命线免死）
 * - /api/orders/{id}/transit | /api/waves/{id}/claim ➔ CORE_FULFILLMENT（在途履约）
 * - POST /api/demands | /api/waves       ➔ NEW_DEMAND（新需求发布）
 * - /api/admin/bi | /api/ai/inspect-xxx  ➔ NON_CORE_ANALYTICS（分析类非核心）
 * - 其它（含既有 99 个存量 API）          ➔ GENERAL_READ（只增不改，保守放行）
 */
export function classifyApiPath(pathname: string, method: string): SystemActionCategory {
  if (pathname.startsWith("/api/sos/")) return "CRITICAL_SOS";
  if (/^\/api\/orders\/[^/]+\/transit$/.test(pathname)) return "CORE_FULFILLMENT";
  if (/^\/api\/waves\/[^/]+\/claim$/.test(pathname)) return "CORE_FULFILLMENT";
  if (
    (pathname === "/api/demands" || pathname === "/api/waves") &&
    method === "POST"
  ) {
    return "NEW_DEMAND";
  }
  if (pathname.startsWith("/api/admin/bi") || pathname.startsWith("/api/ai/inspect-")) {
    return "NON_CORE_ANALYTICS";
  }
  return "GENERAL_READ";
}

export function isDegradationLevel(v: unknown): v is DegradationLevel {
  return typeof v === "string" && (DEGRADATION_LEVELS as readonly string[]).includes(v);
}

/** 面板展示用：某个等级下各类别的放行/阻断规则（确定性派生，零 UI 依赖）。 */
export function describeDegradationRules(level: DegradationLevel): {
  category: SystemActionCategory;
  allowed: boolean;
  httpStatus: number | null;
  errorCode: string | null;
}[] {
  const row = DEGRADATION_MATRIX[level] ?? DEGRADATION_MATRIX.NORMAL;
  const categories: SystemActionCategory[] = [
    "CRITICAL_SOS",
    "CORE_FULFILLMENT",
    "NEW_DEMAND",
    "NON_CORE_ANALYTICS",
    "GENERAL_READ",
  ];
  return categories.map((c) => {
    const d = row[c] ?? ALLOW;
    return {
      category: c,
      allowed: d.isAllowed,
      httpStatus: d.httpStatus ?? null,
      errorCode: d.errorCode ?? null,
    };
  });
}

/** 面板展示用：等级中文说明（纯数据）。 */
export const DEGRADATION_LEVEL_META: Record<DegradationLevel, { label: string; desc: string }> = {
  NORMAL: { label: "正常运营", desc: "全量放行，一切请求正常处理" },
  DROP_NON_CORE: { label: "关闭非核心", desc: "阻断分析类服务，保留核心交易与浏览" },
  RATE_LIMIT_QUEUE: { label: "排队限流", desc: "新需求发布限流 429 + Retry-After 5s" },
  PRESERVE_CORE: { label: "核心保活", desc: "仅放行一键 SOS 与在途履约状态跃迁" },
  READ_ONLY: { label: "全站只读", desc: "仅放行 SOS 与只读请求，阻断一切写操作" },
};

// ---------- 全局运行时等级控制器（持久化注入式适配）----------

export interface ResiliencePersistence {
  /** 读取持久化的等级；不存在/损坏返回 null（回落内存值）。 */
  read(): DegradationLevel | null;
  /** 写入持久化等级；成功返回 true。 */
  write(level: DegradationLevel): boolean;
}

let memoryLevel: DegradationLevel = "NORMAL" as DegradationLevel;
let persistence: ResiliencePersistence | null = null;

/**
 * 挂载持久化适配器（服务端用文件实现，客户端不挂载保持纯内存）。
 * 幂等：重复挂载以最后一次为准。
 */
export function configureResiliencePersistence(p: ResiliencePersistence | null): void {
  persistence = p;
}

/**
 * 读取全局运行等级：优先持久化层（proxy 与 route handler 分属不同 bundle，
 * 模块级内存不共享，以持久化层为唯一跨层事实源），缺失/损坏回落内存值。
 * 注意：get 只读不写内存 —— 内存仅由 set* 显式更新，避免文件删除后
 * 网关停留在已被持久化的历史等级。
 */
export function getGlobalDegradationLevel(): DegradationLevel {
  if (persistence) {
    const fromStore = persistence.read();
    if (fromStore !== null) return fromStore;
  }
  return memoryLevel;
}

/**
 * 设置全局运行等级：写入内存 + 同步持久化层（若已挂载）。
 * 持久化失败不抛异常（降级到纯内存，进程内仍然生效），返回是否落盘。
 */
export function setGlobalDegradationLevel(
  level: DegradationLevel
): { level: DegradationLevel; persisted: boolean } {
  memoryLevel = level;
  const persisted = persistence ? persistence.write(level) : true;
  return { level, persisted };
}

/** 仅内存态（不落盘）：供纯单测确定性使用。 */
export function setGlobalDegradationLevelMemory(level: DegradationLevel): DegradationLevel {
  memoryLevel = level;
  return level;
}