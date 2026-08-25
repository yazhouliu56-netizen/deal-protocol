/**
 * L4-M4 危机干预协议增强引擎（P2 战役第一波攻坚，2026-08-17）。
 * 三大件：
 *  ① 实时位置轨迹面包屑（Breadcrumb Tracker）：履约中的最近 N 处轨迹点 + 位移异常判定
 *     （≥120km/h 超速漂移预警）+ 压缩轨迹载荷（紧急上报警方）；
 *  ② 离线录音切片加密缓冲池（AudioChunkBuffer）：切片元数据管理（chunkId/waveId/
 *     durationSec/sha256/encryptedBase64），FIFO 逐出 + SHA-256 完整性校验；
 *  ③ 60s 危机升级状态机（Escalation State Machine）：
 *     TRIGGERED(0s) ➔ ACKNOWLEDGED(≤30s 确认) ➔ POLICE_ESCALATED(≥60s 未确认强升级) ➔ RESOLVED，
 *     每次跃迁生成对应的紧急通知载荷。
 * 红线 1：全部为纯确定性纯函数/无状态类，零概率分支、零 Date.now 隐式取值（时间全部入参）；
 * 红线 3：base/safe 纯函数引擎，零 React / UI Store 反向依赖。
 */

import { distanceKm } from "../geo/geo.ts";
import { sha256Hex } from "../ai/forgery.ts";

/* ═══════════════ ① 实时位置轨迹面包屑 ═══════════════ */

export interface BreadcrumbPoint {
  lat: number;
  lng: number;
  /** 定位精度（米）。 */
  accuracy: number;
  /** 采样时间戳（ms）。 */
  timestamp: number;
}

export interface BreadcrumbResult {
  /** 最近 N 处轨迹点（按时间序，尾部为最新）。 */
  points: BreadcrumbPoint[];
  /** 被逐出/拒绝丢弃的点数（含非法坐标）。 */
  dropped: number;
}

const KMH = 3600;

/** 经纬度欧氏安全域（Haversine 由 base/geo 提供，此处只管采样窗口合法性）。 */
function isFinitePoint(p: BreadcrumbPoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp);
}

/**
 * 记录一处新轨迹点：追加并裁剪至最近 maxPoints 处（FIFO），非法坐标直接拒绝。
 * 纯函数，返回裁剪后的轨迹与丢弃计数。
 */
export function recordBreadcrumbPoint(
  points: BreadcrumbPoint[],
  point: BreadcrumbPoint,
  maxPoints = 64
): BreadcrumbResult {
  if (!isFinitePoint(point)) {
    return { points, dropped: 1 };
  }
  const next = [...points, point];
  if (next.length <= maxPoints) return { points: next, dropped: 0 };
  const evicted = next.length - maxPoints;
  return { points: next.slice(evicted), dropped: evicted };
}

export interface TrajectoryAnomaly {
  /** 是否命中位移异常（超速漂移）。 */
  anomaly: boolean;
  /** 最近两点间瞬时位移速度（km/h）；样本不足/时间戳无效时为 null。 */
  speedKmh: number | null;
  /** 异常原因标签（SPEED_OVER_LIMIT / STALE_TIMESTAMP / INSUFFICIENT_SAMPLES / null）。 */
  reason: string | null;
}

/**
 * 轨迹位移异常判定：取最近两点，Haversine 距离 / 时间差 → 瞬时速度（km/h）。
 * 速度 ≥ speedAlertKmh（默认 120）即判超速漂移预警。纯确定性。
 */
export function detectTrajectoryAnomaly(
  points: BreadcrumbPoint[],
  speedAlertKmh = 120
): TrajectoryAnomaly {
  if (points.length < 2) {
    return { anomaly: false, speedKmh: null, reason: "INSUFFICIENT_SAMPLES" };
  }
  const prev = points[points.length - 2];
  const last = points[points.length - 1];
  const dtMs = last.timestamp - prev.timestamp;
  if (dtMs <= 0) {
    return { anomaly: false, speedKmh: null, reason: "STALE_TIMESTAMP" };
  }
  const distKm = distanceKm({ lat: prev.lat, lng: prev.lng }, { lat: last.lat, lng: last.lng });
  const speedKmh = (distKm / (dtMs / 1000)) * KMH;
  return speedKmh >= speedAlertKmh
    ? { anomaly: true, speedKmh, reason: "SPEED_OVER_LIMIT" }
    : { anomaly: false, speedKmh, reason: null };
}

export interface TrajectoryPolicePayload {
  /** 局势标签（供 110 通道快速研判）。 */
  crisisId?: string;
  userId?: string;
  /** 载荷生成时间戳（ms）。 */
  generatedAt: number;
  /** 轨迹点数。 */
  pointCount: number;
  /** 最新点位。 */
  lastPoint: BreadcrumbPoint | null;
  /** 最近瞬时速度（km/h）。 */
  speedKmh: number | null;
  /** 命中异常标签列表（如 SPEED_OVER_LIMIT）。 */
  anomalyFlags: string[];
  /** 压缩轨迹载荷：「lat,lng,acc,ts|…」UTC 毫秒，供警方通道一段式投递。 */
  trail: string;
}

/** 压缩轨迹载荷：把轨迹点编码为单串（经纬度 6 位小数 + 精度取整 + UTC 毫秒）。 */
export function compressTrail(points: BreadcrumbPoint[]): string {
  return points
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)},${Math.round(p.accuracy)},${p.timestamp}`)
    .join("|");
}

/**
 * 导出紧急上报警方的压缩轨迹载荷：含末点、瞬时速度、异常标记与 trail 串。
 * 纯函数，输入即输出，SSR 安全。
 */
export function buildPoliceTrajectoryPayload(
  points: BreadcrumbPoint[],
  extra: { crisisId?: string; userId?: string; generatedAt?: number; speedAlertKmh?: number } = {}
): TrajectoryPolicePayload {
  const alert = detectTrajectoryAnomaly(points, extra.speedAlertKmh ?? 120);
  const last = points.length > 0 ? points[points.length - 1] : null;
  return {
    ...(extra.crisisId ? { crisisId: extra.crisisId } : {}),
    ...(extra.userId ? { userId: extra.userId } : {}),
    generatedAt: extra.generatedAt ?? (last ? last.timestamp : 0),
    pointCount: points.length,
    lastPoint: last,
    speedKmh: alert.speedKmh,
    anomalyFlags: alert.anomaly ? [alert.reason ?? "SPEED_OVER_LIMIT"] : [],
    trail: compressTrail(points),
  };
}

/* ═══════════════ ② 离线录音切片加密缓冲池 ═══════════════ */

export interface AudioChunkMeta {
  chunkId: string;
  /** 关联危机/波次 ID。 */
  waveId: string;
  /** 切片时长（秒）。 */
  durationSec: number;
  /** 加密后载荷的 SHA-256 完整性指纹（小写 64 位 hex）。 */
  sha256: string;
  /** 加密后切片（Base64），离线加密缓冲。 */
  encryptedBase64: string;
  /** 录制时间戳（ms）。 */
  recordedAt: number;
}

export interface AudioChunkPushResult {
  /** 当前缓冲（容量裁剪后）。 */
  buffer: AudioChunkMeta[];
  /** 因上限（条数/总字节）被 FIFO 逐出的旧切片。 */
  dropped: AudioChunkMeta[];
}

export interface AudioIntegrityResult {
  ok: boolean;
  /** 指纹不匹配的切片 id（数据损坏/篡改信号）。 */
  failedChunkIds: string[];
  /** 参与校验的切片数。 */
  verified: number;
}

/**
 * 离线录音切片加密缓冲池：纯内存 FIFO，无 I/O、无随机源。
 * 限条数（默认 64）与限总负载字节（默认 4 MiB），超限逐出最旧切片；
 * sha256 指纹可随时复核完整性（重算 sha256Hex(encryptedBase64) === 入库指纹）。
 */
export class AudioChunkBuffer {
  private chunks: AudioChunkMeta[] = [];
  private readonly maxChunks: number;
  private readonly maxTotalBytes: number;

  constructor(maxChunks = 64, maxTotalBytes = 4 * 1024 * 1024) {
    this.maxChunks = maxChunks;
    this.maxTotalBytes = maxTotalBytes;
  }

  /** 入池一条切片；chunkId 缺省时按 waveId+时间+序号确定性合成。 */
  pushAudioChunk(chunk: Omit<AudioChunkMeta, "chunkId"> & { chunkId?: string }): AudioChunkPushResult {
    const chunkId =
      chunk.chunkId ??
      `audio-${chunk.waveId}-${chunk.recordedAt.toString(36)}-${this.chunks.length.toString(36)}`;
    const entry: AudioChunkMeta = { ...chunk, chunkId };
    const dropped: AudioChunkMeta[] = [];
    let next = [...this.chunks, entry];
    while (
      next.length > this.maxChunks ||
      byteSizeOf(next) > this.maxTotalBytes
    ) {
      const evicted = next[0];
      next = next.slice(1);
      dropped.push(evicted);
    }
    this.chunks = next;
    return { buffer: this.chunks, dropped };
  }

  /** 清空缓冲并整体取出（联网后一键上抛安全中心）。 */
  drainAudioChunks(): AudioChunkMeta[] {
    const out = this.chunks;
    this.chunks = [];
    return out;
  }

  /** 完整性校验：逐条重算 SHA-256，返回失败切片清单（纯确定性）。 */
  verifyAudioIntegrity(): AudioIntegrityResult {
    const failedChunkIds: string[] = [];
    for (const c of this.chunks) {
      if (sha256Hex(c.encryptedBase64) !== c.sha256) {
        failedChunkIds.push(c.chunkId);
      }
    }
    return {
      ok: failedChunkIds.length === 0,
      failedChunkIds,
      verified: this.chunks.length,
    };
  }

  count(): number {
    return this.chunks.length;
  }

  totalBytes(): number {
    return byteSizeOf(this.chunks);
  }

  isEmpty(): boolean {
    return this.chunks.length === 0;
  }
}

function byteSizeOf(chunks: AudioChunkMeta[]): number {
  return chunks.reduce((sum, c) => sum + c.encryptedBase64.length, 0);
}

/* ═══════════════ ③ 60s 危机升级状态机 ═══════════════ */

export type EscalationPhase = "TRIGGERED" | "ACKNOWLEDGED" | "POLICE_ESCALATED" | "RESOLVED";

/** 危机级别（0-3，与 crisis.ts EPA 语义对齐，本模块自持避免循环依赖）。 */
export type EscalationLevel = 0 | 1 | 2 | 3;

/** 期望确认窗口：≤30s 内确认（超窗记为 breach，记录不阻断）。 */
export const ESCALATION_ACK_WINDOW_MS = 30_000;
/** 强升级窗口：≥60s 未确认 → 警方通道强升级。 */
export const ESCALATION_POLICE_WINDOW_MS = 60_000;

/** EPA 通知对象映射（与 crisis.ts EPA_BY_LEVEL 对齐的本地确定性拷贝）。 */
export const ESCALATION_EPA_BY_LEVEL: Record<EscalationLevel, readonly string[]> = {
  0: [],
  1: ["紧急联系人"],
  2: ["紧急联系人", "平台值班"],
  3: ["紧急联系人", "平台值班", "警方通道"],
};

export interface EscalationState {
  crisisId: string;
  phase: EscalationPhase;
  level: EscalationLevel;
  /** 触发时间戳（0s）。 */
  triggeredAt: number;
  /** 用户/随行确认时间戳。 */
  acknowledgedAt?: number;
  /** 警方强升级时间戳。 */
  policeEscalatedAt?: number;
  /** 处置闭环时间戳。 */
  resolvedAt?: number;
}

export interface EscalationNotification {
  crisisId: string;
  /** 触发该通知后的目标阶段。 */
  phase: EscalationPhase;
  /** 通知对象（EPA 递增语义）。 */
  to: string[];
  /** 原因标签（TRIGGERED / USER_ACKNOWLEDGED / UNCONFIRMED_60S_FORCE_ESCALATION / CRISIS_RESOLVED）。 */
  reason: string;
  at: number;
}

export interface EscalationStep {
  state: EscalationState;
  /** 阶段是否发生跃迁。 */
  changed: boolean;
  /** 跃迁时生成的通知载荷（未跃迁为 null）。 */
  notification: EscalationNotification | null;
}

/** 触发危机：0s 进入 TRIGGERED，按级别全量 EPA 通知。 */
export function triggerCrisisEscalation(
  crisisId: string,
  now: number,
  level: EscalationLevel = 3
): EscalationStep {
  const state: EscalationState = {
    crisisId,
    phase: "TRIGGERED",
    level,
    triggeredAt: now,
  };
  return {
    state,
    changed: true,
    notification: {
      crisisId,
      phase: "TRIGGERED",
      to: [...ESCALATION_EPA_BY_LEVEL[level]],
      reason: "TRIGGERED",
      at: now,
    },
  };
}

/**
 * 用户确认：TRIGGERED → ACKNOWLEDGED（≤30s 期望窗口，超窗记 breach 不阻断）。
 * 已在确认/升级/闭环态时幂等返回（changed=false）。
 */
export function acknowledgeCrisisEscalation(
  state: EscalationState,
  now: number
): EscalationStep {
  if (state.phase !== "TRIGGERED") {
    return { state, changed: false, notification: null };
  }
  const late = now - state.triggeredAt > ESCALATION_ACK_WINDOW_MS;
  const next: EscalationState = { ...state, phase: "ACKNOWLEDGED", acknowledgedAt: now };
  return {
    state: next,
    changed: true,
    notification: {
      crisisId: state.crisisId,
      phase: "ACKNOWLEDGED",
      to: [...ESCALATION_EPA_BY_LEVEL[state.level]],
      reason: late ? "USER_ACKNOWLEDGED_LATE" : "USER_ACKNOWLEDGED",
      at: now,
    },
  };
}

/**
 * 时钟推进：模拟时间流逝后的状态判定。
 * TRIGGERED 且 elapsed ≥60s 未确认 → POLICE_ESCALATED（警方通道强升级）；
 * 其余阶段幂等（RESOLVED/POLICE_ESCALATED/ACKNOWLEDGED 不再跃迁）。
 */
export function advanceCrisisEscalation(
  state: EscalationState,
  now: number
): EscalationStep {
  if (state.phase !== "TRIGGERED") {
    return { state, changed: false, notification: null };
  }
  if (now - state.triggeredAt < ESCALATION_POLICE_WINDOW_MS) {
    return { state, changed: false, notification: null };
  }
  const next: EscalationState = {
    ...state,
    phase: "POLICE_ESCALATED",
    policeEscalatedAt: now,
  };
  return {
    state: next,
    changed: true,
    notification: {
      crisisId: state.crisisId,
      phase: "POLICE_ESCALATED",
      to: ["警方通道"],
      reason: "UNCONFIRMED_60S_FORCE_ESCALATION",
      at: now,
    },
  };
}

/** 处置闭环：任意未闭环阶段 → RESOLVED（通知紧急联系人收尾）。 */
export function resolveCrisisEscalation(
  state: EscalationState,
  now: number
): EscalationStep {
  if (state.phase === "RESOLVED") {
    return { state, changed: false, notification: null };
  }
  const next: EscalationState = { ...state, phase: "RESOLVED", resolvedAt: now };
  return {
    state: next,
    changed: true,
    notification: {
      crisisId: state.crisisId,
      phase: "RESOLVED",
      to: ["紧急联系人"],
      reason: "CRISIS_RESOLVED",
      at: now,
    },
  };
}

/* ═══════════════ ④ SOS 司法证据快照封装（P1-3 一键 SOS 联动链） ═══════════════ */

/** 音频切片指纹清单摘要（只携带指纹与完整性结论，不携带音频本体）。 */
export interface IAudioEvidenceSummary {
  /** 入包切片数。 */
  chunkCount: number;
  /** 切片负载总字节数（encryptedBase64 长度口径，与缓冲池一致）。 */
  totalBytes: number;
  /** 逐片 SHA-256 指纹（小写 64 位 hex，入池时已固化）。 */
  fingerprints: string[];
  /** 全量指纹复核是否通过。 */
  integrityOk: boolean;
  /** 指纹不匹配的切片 id（篡改/损坏信号）。 */
  failedChunkIds: string[];
}

/**
 * SOS 司法证据快照（强类型）：轨迹警方载荷 + 音频指纹清单 + 确定性快照号。
 * 权威存证哈希由服务端 /api/sos/trigger 以 computeEvidenceHash 重算固化
 * （批次 3b「A 写 B 验」），本结构仅承载客户端本地预指纹。
 */
export interface ISosForensicSnapshot {
  snapshotId: string;
  crisisId?: string;
  userId?: string;
  orderNo?: string;
  level: EscalationLevel;
  /** 快照生成时间戳（ms，时钟注入）。 */
  timestamp: number;
  trajectoryPayload: TrajectoryPolicePayload;
  audioEvidenceSummary: IAudioEvidenceSummary;
}

export interface ISosForensicInput {
  level: EscalationLevel;
  breadcrumbs: readonly BreadcrumbPoint[];
  /** 缓冲池 drain 出的切片（缺省 = 无录音降级空描述）。 */
  audioChunks?: readonly AudioChunkMeta[];
  crisisId?: string;
  userId?: string;
  orderNo?: string;
  speedAlertKmh?: number;
  /** 时钟注入位（红线 1）。 */
  now: number;
}

const NO_GPS_DATA_FLAG = "NO_GPS_DATA";

function summarizeAudioEvidence(
  chunks: readonly AudioChunkMeta[]
): IAudioEvidenceSummary {
  const failedChunkIds: string[] = [];
  for (const c of chunks) {
    if (sha256Hex(c.encryptedBase64) !== c.sha256) {
      failedChunkIds.push(c.chunkId);
    }
  }
  return {
    chunkCount: chunks.length,
    totalBytes: chunks.reduce((sum, c) => sum + c.encryptedBase64.length, 0),
    fingerprints: chunks.map((c) => c.sha256),
    integrityOk: failedChunkIds.length === 0,
    failedChunkIds,
  };
}

/**
 * 一键 SOS 司法证据快照封装（纯函数）：
 * - 轨迹：经 buildPoliceTrajectoryPayload 压缩为 110 警方载荷；
 *   无有效定位点时生成 NO_GPS_DATA 缺省占位（降级是设计的一部分，绝不抛异常）；
 * - 音频：逐片复核 SHA-256 完整性后仅输出指纹清单；
 * - snapshotId：由输入确定性合成（无随机源，同输入同快照号）。
 */
export function packageSosForensicSnapshot(
  input: ISosForensicInput
): ISosForensicSnapshot {
  const points = [...input.breadcrumbs];
  const trajectoryPayload: TrajectoryPolicePayload =
    points.length > 0
      ? buildPoliceTrajectoryPayload(points, {
          crisisId: input.crisisId,
          userId: input.userId,
          generatedAt: input.now,
          speedAlertKmh: input.speedAlertKmh,
        })
      : {
          ...(input.crisisId ? { crisisId: input.crisisId } : {}),
          ...(input.userId ? { userId: input.userId } : {}),
          generatedAt: input.now,
          pointCount: 0,
          lastPoint: null,
          speedKmh: null,
          anomalyFlags: [NO_GPS_DATA_FLAG],
          trail: "",
        };

  const chunks = input.audioChunks ?? [];
  const audioEvidenceSummary = summarizeAudioEvidence(chunks);

  const digestSeed = JSON.stringify({
    level: input.level,
    orderNo: input.orderNo ?? null,
    trail: trajectoryPayload.trail,
    flags: trajectoryPayload.anomalyFlags,
    fingerprints: audioEvidenceSummary.fingerprints,
    timestamp: input.now,
  });

  return {
    snapshotId: `sos-${input.level.toString(36)}-${input.now.toString(36)}-${sha256Hex(digestSeed).slice(0, 8)}`,
    ...(input.crisisId ? { crisisId: input.crisisId } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.orderNo ? { orderNo: input.orderNo } : {}),
    level: input.level,
    timestamp: input.now,
    trajectoryPayload,
    audioEvidenceSummary,
  };
}