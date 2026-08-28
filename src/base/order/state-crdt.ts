/**
 * P2-2 · 离线 CRDT / LWW 状态机确定性合并器（base/order 纯核，红线 1+3）。
 *
 * 硬化裁决固化（H1~H5 + C1-A）：
 *  - H1/H3：终局优先 > CAS version > 有效时钟 LWW > 状态秩 > ID 字典序
 *  - H2：有效时钟严禁补字段；wave: version>0?version:max(expiresAt,startsAt,createdAt)；claim: max(serviceDoneAt,fulfilledAt,createdAt)
 *  - H4：claims/waitlist/joinRequests 按 id/responderId Map 并集 + 单项 LWW
 *  - H5：bizParams 一层浅合并（冲突键以时钟大者覆盖，时钟相等则 JSON 字典序大者），metadata.biddingSettled 以 at 大者为准
 *  - 纯函数：零 fetch/localStorage/navigator/@supabase，零 Store/UI 反向依赖
 */

import type { Wave, WaveMetadata, Claim } from "./wave.ts";

export type WaveStatus = Wave["status"];
export type ClaimStatus = Claim["status"];

// H1：终局集锁定（汇聚终态，永不回退）
const TERMINAL_WAVE = new Set<WaveStatus>(["closed", "expired"]);
const TERMINAL_CLAIM = new Set<ClaimStatus>(["accepted", "breached", "withdrawn"]);

export function isTerminalWave(s: WaveStatus): boolean {
  return TERMINAL_WAVE.has(s);
}

export function isTerminalClaim(s: ClaimStatus): boolean {
  return TERMINAL_CLAIM.has(s);
}

// H1：状态秩（进度深度，数值越大越新）
export function waveStatusRank(s: WaveStatus): number {
  switch (s) {
    case "pending":
      return 10;
    case "active":
      return 20;
    case "claimed":
      return 30;
    case "assembled":
      return 35;
    case "locked":
      return 40;
    case "closed":
      return 100;
    case "expired":
      return 100;
    default:
      return 0;
  }
}

export function claimStatusRank(s: ClaimStatus): number {
  switch (s) {
    case "offered":
      return 10;
    case "negotiating":
      return 20;
    case "joined":
      return 30;
    case "accepted":
      return 100;
    case "breached":
      return 100;
    case "withdrawn":
      return 100;
    default:
      return 0;
  }
}

// H2：有效时钟（严禁补字段，守宪法 #2）
export function effectiveTimestampWave(w: Wave): number {
  const v = w.version ?? 0;
  if (v > 0) return v;
  return Math.max(w.expiresAt ?? 0, w.startsAt ?? 0, w.createdAt ?? 0);
}

export function effectiveTimestampClaim(c: Claim): number {
  return Math.max(c.serviceDoneAt ?? 0, c.fulfilledAt ?? 0, c.createdAt ?? 0);
}

// 键排序稳定化（消除对象枚举序抖动，确保确定性序列化）
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

// H5：bizParams 一层浅合并（时钟大者覆盖，时钟相等则稳定序列化大者）
function mergeBizParams(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
  aClock: number,
  bClock: number,
): Record<string, unknown> | undefined {
  if (!a && !b) return undefined;
  if (!a) return b ? { ...b } : undefined;
  if (!b) return { ...a };
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, unknown> = {};
  for (const k of [...keys].sort()) {
    const av = a[k];
    const bv = b[k];
    if (av === undefined) out[k] = bv;
    else if (bv === undefined) out[k] = av;
    else if (aClock !== bClock) out[k] = aClock > bClock ? av : bv;
    else {
      // 时钟相等：JSON 稳定序列化字典序大者（确保交换律）
      const as = stableStringify(av);
      const bs = stableStringify(bv);
      out[k] = as >= bs ? av : bv;
    }
  }
  return out;
}

// H4：按 responderId 并集（waitlist / joinRequests）
function mergeByResponderId(
  a: Array<{ responderId: string; at: number }> | undefined,
  b: Array<{ responderId: string; at: number }> | undefined,
): Array<{ responderId: string; at: number }> | undefined {
  const arrA = a ?? [];
  const arrB = b ?? [];
  if (arrA.length === 0 && arrB.length === 0) return arrA.length === 0 && arrB.length === 0 ? undefined : [];
  const map = new Map<string, { responderId: string; at: number }>();
  for (const item of [...arrA, ...arrB]) {
    const prev = map.get(item.responderId);
    if (!prev || item.at > prev.at || (item.at === prev.at && item.responderId > prev.responderId)) {
      // LWW：at 大者胜，相等则字典序（确保交换律）
      // 但需考虑交换律：先遍历 a 再 b 与先 b 再 a 结果需一致，故用 max 而非覆盖序
      const winner = !prev ? item : item.at > prev.at ? item : item.at < prev.at ? prev : item.responderId > prev.responderId ? item : prev;
      // 上述已保证 max；为避免序依赖，统一取 at 大者（相等取字典序大者）
      // 实际以 winner 为准
      map.set(item.responderId, winner);
    } else if (item.at === prev.at) {
      // 已处理
    }
  }
  // 需额外确保交换律：遍历完后按 responderId 排序输出，消除 Map 插入序抖动
  return [...map.values()].sort((x, y) => x.responderId.localeCompare(y.responderId));
}

// Winner 选择元组比较（H1/H3：终局 > version > LWW > rank > id字典序 > JSON字典序）
function pickWaveWinner(a: Wave, b: Wave): { winner: Wave; loser: Wave } {
  const aTerm = isTerminalWave(a.status) ? 1 : 0;
  const bTerm = isTerminalWave(b.status) ? 1 : 0;
  if (aTerm !== bTerm) return aTerm > bTerm ? { winner: a, loser: b } : { winner: b, loser: a };
  const av = a.version ?? 0;
  const bv = b.version ?? 0;
  if (av !== bv) return av > bv ? { winner: a, loser: b } : { winner: b, loser: a };
  const at = effectiveTimestampWave(a);
  const bt = effectiveTimestampWave(b);
  if (at !== bt) return at > bt ? { winner: a, loser: b } : { winner: b, loser: a };
  const ar = waveStatusRank(a.status);
  const br = waveStatusRank(b.status);
  if (ar !== br) return ar > br ? { winner: a, loser: b } : { winner: b, loser: a };
  if (a.id !== b.id) return a.id > b.id ? { winner: a, loser: b } : { winner: b, loser: a };
  const as = stableStringify(a);
  const bs = stableStringify(b);
  if (as !== bs) return as > bs ? { winner: a, loser: b } : { winner: b, loser: a };
  return { winner: a, loser: b };
}

function depositPhaseRank(p?: string): number {
  switch (p) {
    case "forfeited":
      return 3;
    case "confirmed":
    case "refunded":
      return 2;
    case "held":
      return 1;
    default:
      return 0;
  }
}

function pickClaimWinner(a: Claim, b: Claim): { winner: Claim; loser: Claim } {
  const aTerm = isTerminalClaim(a.status) ? 1 : 0;
  const bTerm = isTerminalClaim(b.status) ? 1 : 0;
  if (aTerm !== bTerm) return aTerm > bTerm ? { winner: a, loser: b } : { winner: b, loser: a };
  const ar = claimStatusRank(a.status);
  const br = claimStatusRank(b.status);
  if (ar !== br) return ar > br ? { winner: a, loser: b } : { winner: b, loser: a };
  const apr = depositPhaseRank(a.depositPhase);
  const bpr = depositPhaseRank(b.depositPhase);
  if (apr !== bpr) return apr > bpr ? { winner: a, loser: b } : { winner: b, loser: a };
  const at = effectiveTimestampClaim(a);
  const bt = effectiveTimestampClaim(b);
  if (at !== bt) return at > bt ? { winner: a, loser: b } : { winner: b, loser: a };
  if (a.id !== b.id) return a.id > b.id ? { winner: a, loser: b } : { winner: b, loser: a };
  const as = stableStringify(a);
  const bs = stableStringify(b);
  if (as !== bs) return as > bs ? { winner: a, loser: b } : { winner: b, loser: a };
  return { winner: a, loser: b };
}

/**
 * 纯函数：合并单条 Claim（幂等、交换、结合）。
 * 数组字段 reviewedBy/guests/modules 按并集去重；标量以 winner 为准，关键时间戳与 settled 取 max/OR。
 */
export function mergeClaim(local: Claim, remote: Claim): Claim {
  if (!local) return remote;
  if (!remote) return local;
  if (local.id !== remote.id) {
    // 不同 id 的 Claim 不应合并，调用方应走 Map 并集；此处为防御，选 winner 的确定性
    const { winner } = pickClaimWinner(local, remote);
    return { ...winner };
  }
  const { winner, loser } = pickClaimWinner(local, remote);
  // 合并 reviewedBy 并集
  const reviewedSet = new Set<string>([...(winner.reviewedBy ?? []), ...(loser.reviewedBy ?? [])]);
  // 合并 guests 按 responderId 并集（若有）
  let guests: Claim["guests"] | undefined;
  const wg = winner.guests ?? [];
  const lg = loser.guests ?? [];
  if (wg.length > 0 || lg.length > 0) {
    const gmap = new Map<string, NonNullable<Claim["guests"]>[number]>();
    for (const g of [...wg, ...lg]) {
      const key = (g as unknown as { responderId?: string }).responderId ?? JSON.stringify(g);
      const prev = gmap.get(key);
      if (!prev) gmap.set(key, g);
      else {
        // 若重复，取 JSON 大者（确保交换律）
        const ps = stableStringify(prev);
        const cs = stableStringify(g);
        if (cs > ps) gmap.set(key, g);
      }
    }
    guests = [...gmap.values()].sort((a, b) =>
      String((a as unknown as { responderId?: string }).responderId ?? "").localeCompare(
        String((b as unknown as { responderId?: string }).responderId ?? ""),
      ),
    );
  }
  // 合并 modules 按 idx 并集 + 状态秩 LWW（H4，模块化履约核心）
  let modules: Claim["modules"] | undefined;
  const lm = local.modules ?? [];
  const rm = remote.modules ?? [];
  if (lm.length > 0 || rm.length > 0) {
    const rankModule = (s: string) => (s === "pending" ? 0 : s === "done" ? 1 : s === "confirmed" ? 2 : 0);
    const mMap = new Map<number, NonNullable<Claim["modules"]>[number]>();
    const allIdx = new Set<number>([...lm.map((m) => m.idx), ...rm.map((m) => m.idx)]);
    for (const idx of allIdx) {
      const a = lm.find((m) => m.idx === idx);
      const b = rm.find((m) => m.idx === idx);
      if (!a) mMap.set(idx, b as NonNullable<Claim["modules"]>[number]);
      else if (!b) mMap.set(idx, a);
      else {
        const ra = rankModule(a.status);
        const rb = rankModule(b.status);
        if (ra !== rb) mMap.set(idx, ra > rb ? a : b);
        else {
          const ta = (a.status === "done" ? a.doneAt ?? 0 : a.status === "confirmed" ? a.confirmedAt ?? 0 : 0);
          const tb = (b.status === "done" ? b.doneAt ?? 0 : b.status === "confirmed" ? b.confirmedAt ?? 0 : 0);
          if (ta !== tb) mMap.set(idx, ta > tb ? a : b);
          else mMap.set(idx, stableStringify(a) >= stableStringify(b) ? a : b);
        }
      }
    }
    modules = [...mMap.values()].sort((x, y) => x.idx - y.idx);
  }
  // lastMessage/lastBy/price 需跟随 rounds/时钟最新的那一端，而非单纯 winner（确保协商消息不丢）
  const lr = local.rounds ?? 0;
  const rr = remote.rounds ?? 0;
  const lt = effectiveTimestampClaim(local);
  const rt = effectiveTimestampClaim(remote);
  let priceSrc: Claim;
  let msgSrc: Claim;
  if (lr !== rr) {
    priceSrc = lr > rr ? local : remote;
    msgSrc = priceSrc;
  } else if (lt !== rt) {
    priceSrc = lt > rt ? local : remote;
    msgSrc = priceSrc;
  } else {
    priceSrc = winner;
    msgSrc = winner;
  }
  const merged: Claim = {
    ...winner,
    // 版本无关，取最大时钟的标量已由 winner 承载；需显式合并并集字段
    reviewedBy: reviewedSet.size > 0 ? [...reviewedSet].sort() : undefined,
    guests: guests && guests.length > 0 ? guests : winner.guests ?? loser.guests,
    modules: modules ?? winner.modules ?? loser.modules,
    // rounds 取最大（确保进度不回退）
    rounds: Math.max(lr, rr),
    // 关键时间戳与终局标志取 max/OR（确保不丢履约进度，满足幂等交换）
    serviceDoneAt: Math.max(local.serviceDoneAt ?? 0, remote.serviceDoneAt ?? 0) || undefined,
    fulfilledAt: Math.max(local.fulfilledAt ?? 0, remote.fulfilledAt ?? 0) || undefined,
    settled: local.settled || remote.settled ? true : undefined,
    price: priceSrc.price ?? winner.price ?? loser.price,
    lastMessage: msgSrc.lastMessage ?? winner.lastMessage ?? loser.lastMessage,
    lastBy: msgSrc.lastBy ?? winner.lastBy ?? loser.lastBy,
  };
  // 清理空数组语义，保持与输入一致的 undefined 形态（避免 flake）
  if (merged.reviewedBy && merged.reviewedBy.length === 0) merged.reviewedBy = undefined;
  if (merged.modules && merged.modules.length === 0) merged.modules = undefined;
  return merged;
}

/**
 * 纯函数：合并 Claim 列表（按 id Map 并集 + 单项 LWW，满足 CRDT 代数律）。
 */
export function mergeClaimLists(local: Claim[], remote: Claim[]): Claim[] {
  const a = local ?? [];
  const b = remote ?? [];
  if (a.length === 0 && b.length === 0) return [];
  const map = new Map<string, Claim>();
  const allIds = new Set<string>([...a.map((c) => c.id), ...b.map((c) => c.id)]);
  for (const id of allIds) {
    const ca = a.find((c) => c.id === id);
    const cb = b.find((c) => c.id === id);
    if (ca && cb) map.set(id, mergeClaim(ca, cb));
    else map.set(id, (ca ?? cb) as Claim);
  }
  return [...map.values()].sort((x, y) => x.id.localeCompare(y.id));
}

/**
 * 纯函数：合并 WaveMetadata（H5：biddingSettled.at 大者为准，其余取有效时钟大者）。
 */
export function mergeMetadata(
  local?: WaveMetadata,
  remote?: WaveMetadata,
): WaveMetadata | undefined {
  if (!local && !remote) return undefined;
  if (!local) return remote ? { ...remote } : undefined;
  if (!remote) return { ...local };
  const out: WaveMetadata = {};
  // 需借助外部时钟比较：取两者中有效时钟大者的 metadata 优先，但本函数无 wave 时钟入参
  // 退化为确定性合并：biddingSettled 按 at 大者，其余数值取 max，字符串取字典序大者
  // 为确保交换律，所有分支均取确定性 max
  const allKeys = new Set<string>([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of allKeys) {
    if (k === "biddingSettled") {
      const lb = (local as Record<string, unknown>).biddingSettled as
        | { at?: number }
        | undefined;
      const rb = (remote as Record<string, unknown>).biddingSettled as
        | { at?: number }
        | undefined;
      if (!lb) out.biddingSettled = rb as WaveMetadata["biddingSettled"];
      else if (!rb) out.biddingSettled = lb as WaveMetadata["biddingSettled"];
      else {
        const lat = lb.at ?? 0;
        const rat = rb.at ?? 0;
        if (lat !== rat) out.biddingSettled = lat > rat ? (lb as WaveMetadata["biddingSettled"]) : (rb as WaveMetadata["biddingSettled"]);
        else {
          const ls = stableStringify(lb);
          const rs = stableStringify(rb);
          out.biddingSettled = ls >= rs ? (lb as WaveMetadata["biddingSettled"]) : (rb as WaveMetadata["biddingSettled"]);
        }
      }
      continue;
    }
    const lv = (local as Record<string, unknown>)[k];
    const rv = (remote as Record<string, unknown>)[k];
    if (lv === undefined) (out as Record<string, unknown>)[k] = rv;
    else if (rv === undefined) (out as Record<string, unknown>)[k] = lv;
    else if (typeof lv === "number" && typeof rv === "number") {
      (out as Record<string, unknown>)[k] = Math.max(lv, rv);
    } else if (Array.isArray(lv) && Array.isArray(rv)) {
      // 数组按并集去重 + 排序（确保交换律）
      const set = new Set<string>([...lv.map(stableStringify), ...rv.map(stableStringify)]);
      // 尽力还原为原类型：若元素为 string，直接取并集排序
      if (lv.length > 0 && typeof lv[0] === "string") {
        (out as Record<string, unknown>)[k] = [...new Set([...(lv as string[]), ...(rv as string[])])].sort();
      } else {
        // 非 string 数组，取并集后按稳定序列化排序，取首个代表（避免复杂结构丢失）
        // 为保持信息，返回并集去重后的数组（按序列化排序）
        const mergedArr = [...mapFromStable(lv as unknown[], rv as unknown[])].sort((a, b) =>
          stableStringify(a).localeCompare(stableStringify(b)),
        );
        (out as Record<string, unknown>)[k] = mergedArr;
      }
      void set;
    } else {
      const ls = stableStringify(lv);
      const rs = stableStringify(rv);
      (out as Record<string, unknown>)[k] = ls >= rs ? lv : rv;
    }
  }
  return out;
}

function mapFromStable(a: unknown[], b: unknown[]): unknown[] {
  const map = new Map<string, unknown>();
  for (const item of [...a, ...b]) map.set(stableStringify(item), item);
  return [...map.values()];
}

/**
 * 纯函数：合并单条 Wave（CRDT/LWW，满足交换/幂等/结合）。
 * 定序：终局 > version > 有效时钟 > 状态秩 > id字典序 > JSON字典序
 * 集合字段：waitlist/joinRequests 按 responderId 并集 LWW，bizParams 浅合并，metadata 委托 mergeMetadata
 */
export function mergeWave(local: Wave, remote: Wave): Wave {
  if (!local) return remote;
  if (!remote) return local;
  // 防御：不同 id 的 Wave 合并仅在 bundle 层面按 id 并集，单条合并要求同 id；此处做确定性兜底
  if (local.id !== remote.id) {
    const { winner } = pickWaveWinner(local, remote);
    return { ...winner, version: Math.max(local.version ?? 0, remote.version ?? 0) };
  }
  const { winner, loser } = pickWaveWinner(local, remote);
  const lt = effectiveTimestampWave(local);
  const rt = effectiveTimestampWave(remote);
  const mergedWaitlist = mergeByResponderId(local.waitlist, remote.waitlist);
  const mergedJoinRequests = mergeByResponderId(local.joinRequests, remote.joinRequests);
  const mergedBiz = mergeBizParams(local.bizParams, remote.bizParams, lt, rt);
  const mergedMeta = mergeMetadata(local.metadata, remote.metadata);

  // 兼容镜像回填（P1-1 脱水：metadata 权威，回填根字段以保旧读路径）
  const hotness = mergedMeta?.hotness ?? winner.hotness ?? loser.hotness;
  const fissionCount = mergedMeta?.fissionCount ?? winner.fissionCount ?? loser.fissionCount;
  const fissionBy = mergedMeta?.fissionBy ?? winner.fissionBy ?? loser.fissionBy;
  const fissionUpdatedAt = mergedMeta?.fissionUpdatedAt ?? winner.fissionUpdatedAt ?? loser.fissionUpdatedAt;
  const biddingSettled = mergedMeta?.biddingSettled ?? winner.biddingSettled ?? loser.biddingSettled;

  const merged: Wave = {
    ...winner,
    version: Math.max(local.version ?? 0, remote.version ?? 0),
    status: winner.status,
    waitlist: mergedWaitlist,
    joinRequests: mergedJoinRequests,
    bizParams: mergedBiz,
    metadata: mergedMeta,
    hotness,
    fissionCount,
    fissionBy,
    fissionUpdatedAt,
    biddingSettled,
  };
  // 清理空并集为 undefined（与输入形态一致，避免空数组 flake）
  if (merged.waitlist && merged.waitlist.length === 0) merged.waitlist = undefined;
  if (merged.joinRequests && merged.joinRequests.length === 0) merged.joinRequests = undefined;
  return merged;
}
