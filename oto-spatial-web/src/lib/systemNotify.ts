/**
 * 本地系统通知（Notification API）— 纯本地能力层。
 * diffNotifEvents：纯函数，比较前后两帧数据，产出应弹的系统通知（可单测）。
 * notify / requestNotifyPermission：window 安全，未授权/不支持时静默 no-op。
 */

export interface SystemNotif {
  id: string;
  title: string;
  body: string;
}

export interface NotifDiffInput {
  meId: string;
  waves: {
    id: string;
    authorId: string;
    status: string;
    capacity?: number;
    basics: { category: string };
    /** 拼位裂变：最后一次真实增量时间戳（变化 → “邀请裂变 +1”）。 */
    fissionUpdatedAt?: number;
  }[];
  claims: {
    id: string;
    waveId: string;
    status: string;
    price?: number;
  }[];
  friendRequests: { id: string; toId: string; fromId: string }[];
}

/** 比较 prev → next 两帧，产出新增事件（按 成局/报价/拼位/接单/好友 五类）。 */
export function diffNotifEvents(
  prev: NotifDiffInput,
  next: NotifDiffInput
): SystemNotif[] {
  const out: SystemNotif[] = [];
  const prevWave = new Map(prev.waves.map((w) => [w.id, w]));
  const prevClaim = new Set(prev.claims.map((c) => c.id));
  const prevFriend = new Set(prev.friendRequests.map((f) => f.id));
  const nextWaveById = new Map(next.waves.map((w) => [w.id, w]));

  // 成局：我的开放局（≥2 人）首次进入 assembled（拼满）。
  for (const w of next.waves) {
    if (w.authorId !== next.meId) continue;
    if ((w.capacity ?? 1) < 2) continue;
    const was = prevWave.get(w.id);
    if (w.status === "assembled" && was?.status !== "assembled") {
      out.push({
        id: `assembled:${w.id}`,
        title: `🎉 ${w.basics.category} 拼满成局`,
        body: "人齐了，去「我的」看看队伍并开始履约",
      });
    }
  }

  // 裂变回报（转介绍杠杆）：我的局的 fissionUpdatedAt 前进 → 有人经分享回应。
  for (const w of next.waves) {
    if (w.authorId !== next.meId) continue;
    const was = prevWave.get(w.id);
    const curAt = w.fissionUpdatedAt ?? 0;
    const prevAt = was?.fissionUpdatedAt ?? 0;
    if (!was || !curAt) continue;
    if (curAt > prevAt) {
      out.push({
        id: `fission:${w.id}:${curAt}`,
        title: `🪃 ${w.basics.category} 邀请裂变 +1`,
        body: "有人通过你的分享加入并回应，分享发力了",
      });
    }
  }

  // 报价/拼位/接单：我的局上出现新 claim。
  for (const c of next.claims) {
    if (prevClaim.has(c.id)) continue;
    const w = nextWaveById.get(c.waveId);
    if (!w || w.authorId !== next.meId) continue;
    if (c.status === "offered") {
      out.push({
        id: `offer:${c.id}`,
        title: `📨 ${w.basics.category} 来了新报价`,
        body: c.price ? `¥${c.price} · 去「我的」拍板` : "快去看看报价",
      });
    } else if (c.status === "joined") {
      out.push({
        id: `joined:${c.id}`,
        title: `🪑 ${w.basics.category} 有人拼位占座`,
        body: "拼位进行中，满员自动成局",
      });
    } else if (c.status === "accepted") {
      const isOpen = (w.capacity ?? 1) >= 2;
      out.push(
        isOpen
          ? {
              id: `accepted:${c.id}`,
              title: `🎉 ${w.basics.category} 拼满成局`,
              body: "最后一位已加入，去「我的」开始履约",
            }
          : {
              id: `accepted:${c.id}`,
              title: `✅ ${w.basics.category} 有人正式接单`,
              body: "去「我的」查看进度与履约",
            }
      );
    }
  }

  // 好友申请：发给我的新请求。
  for (const f of next.friendRequests) {
    if (f.toId !== next.meId) continue;
    if (prevFriend.has(f.id)) continue;
    out.push({
      id: `friend:${f.id}`,
      title: "🤝 新的好友申请",
      body: `来自 ${f.fromId}，去「我的」处理`,
    });
  }

  return out;
}

export type NotifyPermission = "granted" | "denied" | "default";

/** 当前系统通知权限（window 安全；不支持时视为 denied）。 */
export function notifyPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return window.Notification.permission as NotifyPermission;
}

/** 请求系统通知权限（必须由用户手势触发）。 */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  try {
    const p = await window.Notification.requestPermission();
    return p as NotifyPermission;
  } catch {
    return "denied";
  }
}

/** 弹系统通知；未授权/不支持时静默 no-op（不抛错）。 */
export function notify(title: string, body: string): boolean {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    window.Notification.permission !== "granted"
  ) {
    return false;
  }
  try {
    new window.Notification(title, { body, silent: false });
    return true;
  } catch {
    return false;
  }
}