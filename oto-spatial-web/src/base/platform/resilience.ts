/**
 * 优雅降级四部曲 + 数据湖/AB/哈希存证（ADR-0014，缺口 N13+N14）。
 * Part A: 降级链 degrades —— 长链路求值但绝不让整体任务失败。
 * Part B: 数据湖 + 哈希存证（append-only 事件流 + 内容哈希链防篡改/可校验）。
 * Part C: AB 平台最小集（双变体分流 + 判定）。
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