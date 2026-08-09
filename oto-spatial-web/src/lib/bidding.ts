/**
 * 公开竞价（P8 商业化前哨，纯本地 demo）—— 组局主对稀缺需求发起竞价，
 * 响应者出价竞争，价低者中标；平台按成交额抽佣（净额结算）。
 * 纯函数层：只依赖输入 session，无 IO；竞局 close 后任何出价/中标都无效。
 */

export const COMMISSION_RATE = 0.08;
export const MIN_FEE_YUAN = 2;

export type Bid = {
  bidderId: string;
  bidderName: string;
  /** 报价（元）—— 必须 ≥ 保留价。 */
  price: number;
  note: string;
  placedAt: string;
};

export type Award = {
  winnerId: string;
  winnerName: string;
  price: number;
  feeYuan: number;
  netYuan: number;
};

export type BiddingSession = {
  id: string;
  title: string;
  reserveYuan: number;
  status: "open" | "awarded" | "cancelled";
  bids: Bid[];
  award?: Award;
};

export type PlaceBidResult =
  | { ok: true; session: BiddingSession; upserted: boolean }
  | { ok: false; error: "closed" | "below-reserve" | "invalid-price" };

/** 起一个竞价局（reserve = 最低可接收报价）。 */
export function openBidding(
  id: string,
  title: string,
  reserveYuan: number
): BiddingSession {
  return { id, title, reserveYuan, status: "open", bids: [] };
}

/**
 * 出价：闭局拒绝；低于保留价拒绝；同一人重复出价 = 覆盖旧报价（防刷屏）。
 */
export function placeBid(
  session: BiddingSession,
  bid: Bid,
  now: Date = new Date()
): PlaceBidResult {
  if (session.status !== "open") return { ok: false, error: "closed" };
  if (bid.price < session.reserveYuan) {
    return { ok: false, error: "below-reserve" };
  }
  const existed = session.bids.some((b) => b.bidderId === bid.bidderId);
  return {
    ok: true,
    upserted: existed,
    session: {
      ...session,
      bids: [
        ...session.bids.filter((b) => b.bidderId !== bid.bidderId),
        { ...bid, placedAt: now.toISOString() },
      ],
    },
  };
}

/** 价格升序（低者优先），同价先出者优先。 */
export function rankBids(session: BiddingSession): Bid[] {
  return [...session.bids].sort(
    (a, b) => a.price - b.price || a.placedAt.localeCompare(b.placedAt)
  );
}

/** 保留价拦不住时也不会低于该价 —— 需要至少 1 个出价。 */
export function hasBids(session: BiddingSession): boolean {
  return session.bids.length > 0;
}

/** 平台抽佣：成交价 × 费率，下限 MIN_FEE_YUAN。 */
export function commissionOf(price: number): number {
  return Math.max(
    MIN_FEE_YUAN,
    Math.round(price * COMMISSION_RATE * 100) / 100
  );
}

/** 结算：最低报价中标，锁定结果；闭局后不可再出价/结算。 */
export function award(
  session: BiddingSession
): BiddingSession {
  if (session.status !== "open") return session;
  const [winner] = rankBids(session);
  if (!winner) return session;
  const feeYuan = commissionOf(winner.price);
  return {
    ...session,
    status: "awarded",
    award: {
      winnerId: winner.bidderId,
      winnerName: winner.bidderName,
      price: winner.price,
      feeYuan,
      netYuan: Math.round((winner.price - feeYuan) * 100) / 100,
    },
  };
}

/** 组局主放弃：闭局无中标。 */
export function cancelBidding(session: BiddingSession): BiddingSession {
  if (session.status !== "open") return session;
  return { ...session, status: "cancelled" };
}