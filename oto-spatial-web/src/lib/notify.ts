/**
 * 通知中心聚合层（G-3）— 纯函数：跨 store derive 出「近期动态」。
 * 输入共享状态子集 → 输出可按 kind 聚合、排序、标记已读的通知条。
 * 无 IO，读取/写安全。
 */

export type NotifyKind =
  | "offer"
  | "accepted"
  | "push"
  | "friend"
  | "report"
  | "wave";

export interface NotifyItem {
  /** 稳定 id（已读去重键：kind:key） */
  key: string;
  kind: NotifyKind;
  emoji: string;
  title: string;
  desc: string;
  /** 已排序的时间戳（ms）；无则 0 */
  at: number;
}

export interface NotifySource {
  meId: string;
  waves: WaveLike[];
  claims: ClaimLike[];
  pushes: PushLike[];
  friendRequests: FriendRequestLike[];
  reportOutcomes: { id: string; at: number; verdict: string }[];
}

interface WaveLike {
  id: string;
  authorId: string;
  basics: { category: string };
  status: string;
}
interface ClaimLike {
  id: string;
  waveId: string;
  status: string;
  responderId: string;
  price?: number;
  createdAt: number;
}
interface PushLike {
  id: string;
  toId: string;
  waveId: string;
  at: number;
  read?: boolean;
}
interface FriendRequestLike {
  id: string;
  toId: string;
  fromId: string;
  at: number;
}

/**
 * 聚合所有源 → 通知条目（按 at 降序）。push.read=true 视为已读。
 * kind id 已在推送层生成过，含 push 重复 read 语义保持。
 */
export function buildNotifyItems(src: NotifySource): NotifyItem[] {
  const items: NotifyItem[] = [];
  const myWaves = src.waves.filter((w) => w.authorId === src.meId);
  const waveById = new Map(myWaves.map((w) => [w.id, w]));

  // 我的局：报价应答（offered）+ 正式接单（accepted），每局一条最新
  const byWave = new Map<string, ClaimLike>();
  for (const c of src.claims) {
    if (c.responderId === src.meId) continue; // 只看应答者发给我的
    if (!waveById.has(c.waveId)) continue;
    if (!(c.status === "offered" || c.status === "accepted")) continue;
    const cur = byWave.get(c.waveId);
    if (!cur || c.createdAt > cur.createdAt) byWave.set(c.waveId, c);
  }
  for (const [waveId, c] of byWave) {
    const w = waveById.get(waveId)!;
    if (c.status === "accepted") {
      items.push({
        key: `accepted:${waveId}`,
        kind: "accepted",
        emoji: "🎯",
        title: `${w.basics.category} 有人正式接单`,
        desc: "去「我的」查看进度与履约",
        at: c.createdAt,
      });
    } else {
      items.push({
        key: `offer:${waveId}`,
        kind: "offer",
        emoji: "📨",
        title: `${w.basics.category} 来了新报价`,
        desc: c.price ? `¥${c.price} · 去「我的」拍板` : "快去看看报价",
        at: c.createdAt,
      });
    }
  }

  // 雷达推送（读过滤掉已读的）
  for (const p of src.pushes) {
    if (p.toId !== src.meId) continue;
    if (p.read) continue;
    items.push({
      key: `push:${p.id}`,
      kind: "push" as NotifyKind,
      emoji: "📡",
      title: "新雷达适配信号",
      desc: "一条适配推送等你查看",
      at: p.at,
    });
  }

  // 好友请求（待处理）
  for (const f of src.friendRequests) {
    if (f.toId !== src.meId) continue;
    items.push({
      key: `friend:${f.id}`,
      kind: "friend",
      emoji: "🤝",
      title: "新的好友申请",
      desc: `来自 ${f.fromId}`,
      at: f.at,
    });
  }

  // 举报处理结果（只对我发起的）
  for (const r of src.reportOutcomes) {
    items.push({
      key: `report:${r.id}`,
      kind: "report",
      emoji: "🕵️",
      title: "举报已处理",
      desc: r.verdict,
      at: r.at,
    });
  }

  items.sort((a, b) => b.at - a.at);
  return items;
}

/**
 * 已读集合（kind:key 列表）持久化 — localStorage，跨会话。
 * SSR 安全：无 window 时返回空集（不会抛错）。
 */
export function loadReadSet(storage?: Storage): Set<string> {
  const s =
    storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!s) return new Set();
  try {
    const raw = s.getItem("oto-notify-read");
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
      return new Set(arr as string[]);
    }
    return new Set();
  } catch {
    return new Set();
  }
}

export function persistReadSet(
  keys: Iterable<string>,
  storage?: Storage
): void {
  const s =
    storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!s) return;
  try {
    s.setItem("oto-notify-read", JSON.stringify([...keys]));
  } catch {
    /* storage full/denied → ignore */
  }
}