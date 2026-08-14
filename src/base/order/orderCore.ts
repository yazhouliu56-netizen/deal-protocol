/**
 * C1 通用订单状态机（ADR-0007 §2 C1 契约锚点文件）。
 *
 * 发射管接口：底座只认识 OrderCore 这一套通用骨架，弹药（业务形态）通过
 * sealed `ext` 蒙层挂业务字段，底座不感知。
 *
 * 本文件是契约的落地物：
 *  1. OrderStatus / OrderCore 定义（新弹药状态机必须能投影到此枚举）；
 *  2. toOrderCore() 投影桥：现存 Wave（需求局弹药）→ OrderCore 视图，
 *     不改变 Wave 自身语义（宪法 #2：接口只可增补、不可改义）。
 */

export type OrderStatus =
  | "pending" // 待接（已发布/已支付未激活）
  | "matched" // 已匹配（单对单 claimed / 组局 partial）
  | "locked" // 锁定（磋商关闭，不可再抢）
  | "assembled" // 成局（容量满，仅组局）
  | "fulfilling" // 履约中
  | "reviewing" // 验收/评价窗
  | "settled" // 结算完成
  | "cancelled" // 取消（需求方主动关闭）
  | "expired"; // 过期

/** 通用订单骨架 —— 弹药无关。业务字段挂在 ext 蒙层。 */
export interface OrderCore {
  id: string;
  ownerId: string;
  status: OrderStatus;
  amountYuan: number;
  /** 1 = 单对单；≥2 = 组局。 */
  capacity: number;
  /** 组局占位（已认领的席位）。 */
  slotIds?: string[];
  startsAt?: number;
  expiresAt: number;
  createdAt: number;
  lockedAt?: number;
  settledAt?: number;
  /** 弹药蒙层：业务扩展字段。底座只透传，不读取。 */
  ext?: Record<string, unknown>;
}

/**
 * WaveStatus → OrderStatus 投影表（弹药状态机与底座状态机的桥）。
 * 任何新弹药的状态机必须能映射到 OrderStatus，映射关系写死在此，
 * 不允许各自为政。
 */
const WAVE_TO_ORDER: Record<string, OrderStatus> = {
  pending: "pending",
  active: "matched",
  claimed: "matched",
  locked: "locked",
  assembled: "assembled",
  closed: "cancelled",
  expired: "expired",
};

export function orderStatusOf(waveStatus: string): OrderStatus {
  return WAVE_TO_ORDER[waveStatus] ?? "pending";
}

/**
 * 投影桥：Wave（需求局弹药）→ OrderCore 视图。
 * 不修改原对象；履约中/验收窗由 claim 侧数据补充（ext 透传）。
 */
export function toOrderCore(wave: {
  id: string;
  authorId: string;
  status: string;
  budget: number;
  capacity: number;
  expiresAt: number;
  createdAt: number;
  startsAt?: number;
  claimedById?: string;
  hotness?: number;
}): OrderCore {
  return {
    id: wave.id,
    ownerId: wave.authorId,
    status: orderStatusOf(wave.status),
    amountYuan: wave.budget,
    capacity: wave.capacity,
    startsAt: wave.startsAt,
    expiresAt: wave.expiresAt,
    createdAt: wave.createdAt,
    slotIds: wave.claimedById ? [wave.claimedById] : undefined,
    ext: wave.hotness !== undefined ? { hotness: wave.hotness } : undefined,
  };
}