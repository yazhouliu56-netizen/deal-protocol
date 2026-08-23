/**
 * 弱网离线队列（ADR-0014，缺口 N11）。
 * 写操作离线缓冲：入队 → 重放（幂等去重）→ 失败退避。
 * 纯函数 + 可选自定义调度；SSR 安全。
 */

export type QueueOp =
  | { kind: "sendIm"; payload: string }
  | { kind: "publish"; payload: string }
  | { kind: "claim"; payload: string }
  | { kind: "review"; payload: string }
  /** Step 2 接电：权威库 write-behind 同步（payload = JSON{path,body,idempotencyKey}）。 */
  | { kind: "order-publish"; payload: string }
  | { kind: "order-transition"; payload: string };

export interface QueuedOp {
  id: string;
  op: QueueOp;
  queuedAt: number;
  attempts: number;
  /** 下一次尝试时间（指数退避）。 */
  tryAt: number;
  done: boolean;
}

/** 入队（幂等：同 kind+payload 未完成不重复入队）。 */
export function enqueue(
  q: QueuedOp[],
  op: QueueOp,
  now: number
): { q: QueuedOp[]; item: QueuedOp; fresh: boolean } {
  const dup = q.find((x) => !x.done && x.op.kind === op.kind && x.op.payload === op.payload);
  if (dup) return { q, item: dup, fresh: false };
  const item: QueuedOp = { id: `q-${now.toString(36)}-${q.length}`, op, queuedAt: now, attempts: 0, tryAt: now, done: false };
  return { q: [...q, item], item, fresh: true };
}

/** 取出当前可重放的待办（按 tryAt 升序，自动跳过错过的退避窗）。 */
export function due(q: QueuedOp[], now: number): QueuedOp[] {
  return q.filter((x) => !x.done && x.tryAt <= now).sort((a, b) => a.tryAt - b.tryAt);
}

/** 重放结果反馈：成功 → done；失败 → 退避（指数 ×2，上限 10 分钟）。 */
export function markPlayed(
  q: QueuedOp[],
  id: string,
  ok: boolean,
  now: number
): QueuedOp[] {
  const BACKOFF_MAX = 10 * 60_000;
  return q.map((x) => {
    if (x.id !== id) return x;
    if (ok) return { ...x, done: true, doneAt: now };
    const attempts = x.attempts + 1;
    const backoff = Math.min(BACKOFF_MAX, 1000 * 2 ** attempts);
    return { ...x, attempts, tryAt: now + backoff };
  });
}

/** 清理已完成项（压缩队列，可选）。 */
export function compact(q: QueuedOp[]): QueuedOp[] {
  return q.filter((x) => !x.done);
}