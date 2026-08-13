/**
 * IM 私信中枢（ADR-0010，缺口 N15 的 IM 部分）。
 * 用户间一对一私信线程：消息、已读、线程列表。无外部依赖，纯函数。
 * 与隐私号联动：订单侧可一键生成隐私会话并引导拨打（场景由 store 组合）。
 */

export type ImMsg = {
  id: string;
  threadId: string;
  fromId: string;
  at: number;
  text: string;
  /** 关联订单（可选，用于从订单卡片直达）。 */
  waveId?: string;
};

export type ImThread = {
  id: string;
  aId: string;
  bId: string;
  lastAt: number;
  /** 未读计数（对方视角累计）。 */
  unreadA: number;
  unreadB: number;
};

export function keyOf(x: string, y: string): string {
  return [x, y].sort().join("|");
}

/** 取/建线程（幂等：keyOf 归一）。 */
export function ensureThread(
  threads: ImThread[],
  aId: string,
  bId: string,
  now: number
): { threads: ImThread[]; thread: ImThread; fresh: boolean } {
  const k = keyOf(aId, bId);
  const existing = threads.find((t) => t.id === k);
  if (existing) return { threads, thread: existing, fresh: false };
  const thread: ImThread = { id: k, aId, bId, lastAt: now, unreadA: 0, unreadB: 0 };
  return { threads: [...threads, thread], thread, fresh: true };
}

/** 发消息：写线程 + 收件人未读 +1。 */
export function sendMsg(
  threads: ImThread[],
  messages: ImMsg[],
  fromId: string,
  toId: string,
  text: string,
  now: number,
  waveId?: string
): { threads: ImThread[]; messages: ImMsg[]; msg: ImMsg } {
  const { threads: t2, thread, fresh } = ensureThread(threads, fromId, toId, now);
  const msg: ImMsg = {
    id: `m-${now.toString(36)}-${messages.length}`,
    threadId: thread.id,
    fromId,
    at: now,
    text,
    ...(waveId ? { waveId } : {}),
  };
  const nextThread: ImThread = {
    ...thread,
    lastAt: now,
    unreadA: thread.unreadA + (toId === thread.aId ? 1 : 0),
    unreadB: thread.unreadB + (toId === thread.bId ? 1 : 0),
  };
  return {
    threads: fresh ? t2 : threads.map((t) => (t.id === thread.id ? nextThread : t)),
    messages: [...messages, msg],
    msg,
  };
}

/** 读线程：清空该方未读（幂等）。 */
export function markRead(threads: ImThread[], threadId: string, whoId: string): ImThread[] {
  return threads.map((t) =>
    t.id === threadId
      ? { ...t, unreadA: t.aId === whoId ? 0 : t.unreadA, unreadB: t.bId === whoId ? 0 : t.unreadB }
      : t
  );
}

/** 线程消息列表（按时间序）。 */
export function threadMessages(messages: ImMsg[], threadId: string): ImMsg[] {
  return messages.filter((m) => m.threadId === threadId).sort((x, y) => x.at - y.at);
}

/** 某用户的总未读数（tab 徽章）。 */
export function unreadTotal(threads: ImThread[], whoId: string): number {
  return threads.reduce((s, t) => s + (t.aId === whoId ? t.unreadA : t.bId === whoId ? t.unreadB : 0), 0);
}