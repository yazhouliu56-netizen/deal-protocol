/**
 * 共享广播空间契约（P2P transport blob）。
 *
 * 上收自 `store/useWaveStore` —— 底座 transport（base/platform/p2p）只认此
 * 契约，不依赖 UI 状态层。所有字段类型均来自 base 域，本文件仅做聚合声明。
 * 宪法收敛：条文 #3（单向依赖：UI / Ammo → base → types）。
 */
import type { ResponderCapability } from "@/base/dispatch/broadcast";
import type { Claim, Wave } from "@/base/order/wave";
import type { DisputeRecord } from "@/base/order/dispute";
import type { Review } from "@/base/trust/review";
import type { PayOrder } from "@/base/money/pay";
import type { SentinelEvent } from "@/base/risk/sentinel";
import type { PrivacySession } from "@/base/comm/privacyNumber";
import type { ImMsg, ImThread } from "@/base/comm/im";
import type { FriendRequest, Friendship } from "@/base/trust/friends";
import type { PushItem } from "@/base/ai/cluster";
import type { CrisisRecord } from "@/base/safe/crisis";
import type { ForgetRequest } from "@/base/safe/privacy";
import type { Breaker } from "@/base/platform/circuit";
import type { QueuedOp } from "@/base/platform/offlineQueue";
import type { LakeRecord } from "@/base/platform/resilience";
import type { InsurePolicy, SignedDoc } from "@/base/platform/signInsure";
import type { BanRecord, Report } from "@/base/risk/moderation";

export interface WaveBundle {
  waves: Wave[];
  claims: Claim[];
  /** 随单支付流水（共享空间）— 支付/放款/退款全程留痕。 */
  payOrders: PayOrder[];
  /** Capability-declared responders (real identities + mock atmosphere). */
  responders: ResponderCapability[];
  /** 评价（脱敏展示，共享空间）— credit tier derives from these. */
  reviews: Review[];
  /** LLM 聚类推送（雷达收件箱）— recipient-filtered per device. */
  pushes: PushItem[];
  /** 治理：举报流水 + 封禁表（平台级）。 */
  reports: Report[];
  bans: Record<string, BanRecord>;
  /** 我关注的局（雷达心愿单）— 幂等 toggle，不参与撮合。 */
  favorites: string[];
  /** 开放局 no-show 补偿：发起人获得的「成局面降标准」buff（跨会话累计） */
  initiatorBuffs: Record<string, number>;
  /** 履约争议审计（reason-first）— UI 全程可查。 */
  disputes: DisputeRecord[];
  /** S3 关系沉淀：待确认的转友请求（72h 未处理自动撤回）。 */
  friendRequests: FriendRequest[];
  /** S3 关系沉淀：已互认的好友（pair 规范化，双向一条）。 */
  friendships: Friendship[];
  /**
   * 已撤回/已消费的请求 id（tombstone）。transport 合并对集合使用 union
   * 语义（base 还保留旧 id），带删除语义的 friendRequests 必须靠墓碑
   * 才能让「接受/忽略/过期」的移除跨 tab 落盘生效。
   */
  friendRequestRemovals: string[];
  /** 多因子反欺诈探针事件流（ADR-0009）：发布前甄检记录。 */
  sentinelEvents: SentinelEvent[];
  /** ADR-0010：隐私号会话（N1）。 */
  privacySessions: PrivacySession[];
  /** ADR-0010：IM 私信线程与消息（N15）。 */
  imThreads: ImThread[];
  imMessages: ImMsg[];
  /** ADR-0013：极端危机干预记录（N8）。 */
  crisisRecords: CrisisRecord[];
  /** ADR-0013：遗忘权请求登记（N10）。 */
  forgetRequests: ForgetRequest[];
  /** ADR-0014：LLM 聚类熔断器（N12 接线）。 */
  circuitBreaker: Breaker;
  /** ADR-0014：弱网离线队列（N11 接线，sendIm 离线缓冲）。 */
  offlineQueue: QueuedOp[];
  /** ADR-0014：数据湖哈希存证链（N14 接线，关键终局事件 append）。 */
  lake: LakeRecord[];
  /** ADR-0012：验收签章存根（N7 接线，验收时签名可验签）。 */
  signedDocs: SignedDoc[];
  /** ADR-0012：履约保险保单（N7 接线：投保扣保费、违约自动理赔）。 */
  policies: InsurePolicy[];
  /** W5 履约回写位（五态流转终局落库）：waveId → 履约状态 + 结算标记。 */
  fulfilment?: Record<string, { fulfilmentStatus?: "reported" | "confirmed"; isSettled?: boolean }>;
  /** 共享空间单调版本号（transport 写盘守卫用，防早态快照回退覆盖） */
  bundleVer?: number;
}
