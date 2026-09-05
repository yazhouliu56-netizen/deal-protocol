/**
 * L5-M1 多通道适配器 · 多厂商毫秒级动态热备总线（通用故障转移调度器）。
 *
 * 宪法 #10「降级是设计的一部分」：任何外部三方通道（短信/地图逆地理/测距）
 * 都不允许成为唯一依赖 —— 本引擎按优先级探测多厂商通道，连续失败自动
 * 熔断（冷却期跳过）→ 冷却期满半开探测 → 成功自愈；所有外部厂商全挂时
 * 100% 回落本地确定性兜底（短信 Mock 存根 / Haversine 纯数学）。
 *
 * 红线 3：本模块位于 base/platform 底座层，零 React / UI Store 反向依赖；
 * 红线 1：兜底路径纯确定性计算，严禁抛出未捕获异常。
 */

import { createHmac } from "node:crypto";

/** 通道健康三态。 */
export type ChannelHealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY";

/** 厂商枚举（SMS 三家 + LBS 两家 + 本地兜底）。 */
export type VendorType =
  | "ALIYUN"
  | "TENCENT"
  | "HUAWEI"
  | "AMAP"
  | "OPEN_FREE_MAP"
  | "LOCAL_MOCK";

/** 通用厂商通道契约。 */
export interface IVendorChannel<TInput, TOutput> {
  vendor: VendorType;
  /** 优先级（1 最高，先探测）。 */
  priority: number;
  /** 单通道超时（毫秒），超时按失败计。 */
  timeoutMs: number;
  execute: (input: TInput) => Promise<TOutput>;
}

/** 熔断器健康状态（并发安全：模块级状态池按 channelKey 隔离，单线程原子）。 */
export interface ChannelCircuit {
  status: ChannelHealthStatus;
  failures: number;
  /** 熔断时刻（ms 时间戳；0 = 未熔断）。 */
  openedAt: number;
  /** 冷却期满后是否已放行半开探测。 */
  probeUsed: boolean;
}

/** 熔断规则（可注入覆盖，测试用）。 */
export interface ChannelBreakerRules {
  /** 连续失败阈值 → 熔断。 */
  failThreshold: number;
  /** 冷却时长（ms）。 */
  cooldownMs: number;
}

export const DEFAULT_BREAKER_RULES: ChannelBreakerRules = {
  failThreshold: 3,
  cooldownMs: 60_000,
};

/** 调度结果。 */
export interface FallbackResult<TOutput> {
  result: TOutput;
  usedVendor: VendorType;
  /** 实际下跳次数（0 = 首选通道直接成功）。 */
  fallbackHops: number;
}

const HEALTHY_CIRCUIT: ChannelCircuit = {
  status: "HEALTHY",
  failures: 0,
  openedAt: 0,
  probeUsed: false,
};

/** 模块级状态池：`${channelKey}::${vendor}` → 熔断状态（单线程 Map 原子操作）。 */
const circuitStore = new Map<string, ChannelCircuit>();

const circuitKey = (channelKey: string, vendor: VendorType): string => `${channelKey}::${vendor}`;

/** 测试/治理用：重置指定业务线（或全部）的熔断状态。 */
export function resetChannelCircuit(channelKey?: string): void {
  if (channelKey === undefined) {
    circuitStore.clear();
    return;
  }
  for (const key of circuitStore.keys()) {
    if (key.startsWith(`${channelKey}::`)) circuitStore.delete(key);
  }
}

/** 读取指定业务线+厂商的熔断状态（无记录 → HEALTHY）。 */
export function getChannelCircuit(channelKey: string, vendor: VendorType): ChannelCircuit {
  return circuitStore.get(circuitKey(channelKey, vendor)) ?? { ...HEALTHY_CIRCUIT };
}

/** 读取指定业务线全部厂商熔断状态（治理/监控用）。 */
export function listChannelCircuits(
  channelKey: string,
): Array<{ vendor: string; circuit: ChannelCircuit }> {
  const out: Array<{ vendor: string; circuit: ChannelCircuit }> = [];
  for (const [key, circuit] of circuitStore.entries()) {
    if (key.startsWith(`${channelKey}::`)) {
      out.push({ vendor: key.slice(channelKey.length + 2), circuit });
    }
  }
  return out;
}

/**
 * 熔断状态机（纯函数，可注入 now/rules）：
 * - 成功 → HEALTHY 复位（半开探测成功后自愈）；
 * - 失败 → failures+1；达到阈值 → UNHEALTHY 熔断（openedAt = now）；
 * - 熔断中的失败只延长冷却起点；非熔断失败的中间态记 DEGRADED。
 */
export function advanceChannelCircuit(
  circuit: ChannelCircuit,
  ok: boolean,
  now: number,
  rules: ChannelBreakerRules = DEFAULT_BREAKER_RULES,
): ChannelCircuit {
  if (ok) {
    return { ...HEALTHY_CIRCUIT };
  }
  const failures = circuit.failures + 1;
  if (failures >= rules.failThreshold) {
    return { status: "UNHEALTHY", failures, openedAt: now, probeUsed: false };
  }
  return {
    status: "DEGRADED",
    failures,
    openedAt: 0,
    probeUsed: false,
  };
}

/**
 * 请求放行判定（纯函数）：
 * - 非熔断（HEALTHY/DEGRADED）→ 放行；
 * - 熔断未过冷却 → 跳过；
 * - 冷却期满 → 半开探测放行一次（probeUsed 置位防重放），成功后自愈。
 */
export function shouldSkipChannel(
  circuit: ChannelCircuit,
  now: number,
  rules: ChannelBreakerRules = DEFAULT_BREAKER_RULES,
): boolean {
  if (circuit.status !== "UNHEALTHY") return false;
  if (now - circuit.openedAt < rules.cooldownMs) return true;
  return circuit.probeUsed;
}

/** 半开探测放行后标记 probeUsed（冷却期满首次放行）。 */
export function markChannelProbe(circuit: ChannelCircuit): ChannelCircuit {
  return circuit.status === "UNHEALTHY" ? { ...circuit, probeUsed: true } : circuit;
}

/** 指定通道的熔断状态（独立 key 隔离各厂商计数）。 */
function readCircuit(channelKey: string, vendor: VendorType): ChannelCircuit {
  return circuitStore.get(circuitKey(channelKey, vendor)) ?? { ...HEALTHY_CIRCUIT };
}

/**
 * 通用故障转移调度器：按优先级遍历通道，跳过熔断中（未过冷却）的通道，
 * 超时控制（Promise.race），成功复位、失败计数并平滑下跳；所有外部厂商
 * 全失败时执行 LOCAL_MOCK 确定性兜底。
 */
export async function executeWithFallback<TInput, TOutput>(
  channels: IVendorChannel<TInput, TOutput>[],
  input: TInput,
  channelKey: string,
  options?: { rules?: ChannelBreakerRules; now?: () => number },
): Promise<FallbackResult<TOutput>> {
  const rules = options?.rules ?? DEFAULT_BREAKER_RULES;
  const clock = options?.now ?? (() => Date.now());
  const sorted = [...channels].sort((a, b) => a.priority - b.priority);
  const local = sorted.find((c) => c.vendor === "LOCAL_MOCK");
  const externals = sorted.filter((c) => c.vendor !== "LOCAL_MOCK");

  let hops = 0;
  let lastError: unknown = null;

  for (const ch of externals) {
    const circuit = readCircuit(channelKey, ch.vendor);
    if (shouldSkipChannel(circuit, clock(), rules)) {
      hops += 1;
      continue;
    }
    try {
      const result = await withTimeout(ch.execute(input), ch.timeoutMs);
      circuitStore.set(circuitKey(channelKey, ch.vendor), advanceChannelCircuit(circuit, true, clock(), rules));
      return { result, usedVendor: ch.vendor, fallbackHops: hops };
    } catch (err) {
      lastError = err;
      circuitStore.set(circuitKey(channelKey, ch.vendor), advanceChannelCircuit(circuit, false, clock(), rules));
      hops += 1;
    }
  }

  // 红线 1：外部全挂 → LOCAL_MOCK 确定性兜底（兜底通道永不熔断）
  if (local) {
    try {
      const result = await local.execute(input);
      return { result, usedVendor: "LOCAL_MOCK", fallbackHops: hops };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `[MultiChannelGateway] all channels failed for key "${channelKey}": ${String(lastError)}`,
  );
}

/** Promise 超时包装：超时即 reject（不泄漏未 settle 的 promise）。 */
function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// ---------- 短信多通道热备门面 ----------

export interface SmsDispatchInput {
  phone: string;
  title: string;
  content: string;
  /** 覆盖环境变量级签名名（默认读取 env）。 */
  signName?: string;
  templateCode?: string;
  /**
   * 短信验证码（P8 短信接线）。aliyun 通道优先序列化为
   * TemplateParam {"code": code}；缺席时回退 title/content 透传。
   */
  code?: string;
}

export interface SmsDispatchOutput {
  success: boolean;
  /** 厂商侧消息 ID（mock 为存根 id）。 */
  messageId?: string;
}

/** 阿里云短信通道（dysmsapi，无凭证快速失败 → 平滑下跳）。 */
export function buildAliyunSmsChannel(): IVendorChannel<SmsDispatchInput, SmsDispatchOutput> {
  return {
    vendor: "ALIYUN",
    priority: 1,
    timeoutMs: 5_000,
    execute: async (input) => {
      const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID ?? process.env.ALIYUN_SMS_ACCESS_KEY;
      const accessKeySecret =
        process.env.ALIYUN_SMS_ACCESS_KEY_SECRET ?? process.env.ALIYUN_SMS_SECRET;
      if (!accessKeyId || !accessKeySecret) throw new Error("ALIYUN sms key missing");
      const templateParam = input.code
        ? JSON.stringify({ code: input.code })
        : JSON.stringify({ title: input.title, content: input.content });
      const url = signAliyunRpcRequest({
        accessKeyId,
        accessKeySecret,
        actionParams: {
          Action: "SendSms",
          PhoneNumbers: input.phone,
          SignName: input.signName ?? process.env.ALIYUN_SMS_SIGN_NAME ?? "DealProtocol",
          TemplateCode: input.templateCode ?? process.env.ALIYUN_SMS_TEMPLATE_CODE ?? "SMS_EMERGENCY",
          TemplateParam: templateParam,
          Version: "2017-05-25",
        },
      });
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`ALIYUN sms http ${res.status}`);
      const data = (await res.json()) as { Code?: string; Message?: string; RequestId?: string };
      if (data.Code && data.Code !== "OK") {
        throw new Error(`ALIYUN sms api ${data.Code}: ${data.Message ?? ""}`);
      }
      return { success: true, messageId: data.RequestId };
    },
  };
}

/**
 * 阿里云 POP RPC 标准签名（HMAC-SHA1）。
 * StringToSign = HTTPMethod + "&" + percentEncode("/") + "&" +
 *   percentEncode(sorted-by-key CanonicalizedQueryString)。
 * Signature = base64(HMAC-SHA1(AccessKeySecret + "&", StringToSign))。
 */
export function signAliyunRpcRequest(args: {
  accessKeyId: string;
  accessKeySecret: string;
  actionParams: Record<string, string>;
  timestamp?: string;
  nonce?: string;
}): string {
  const allParams: Record<string, string> = {
    Format: "JSON",
    AccessKeyId: args.accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: args.nonce ?? `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    Timestamp: args.timestamp ?? new Date().toISOString(),
    ...args.actionParams,
  };
  const canonicalized = Object.keys(allParams)
    .sort()
    .map((k) => `${aliyunPercentEncode(k)}=${aliyunPercentEncode(allParams[k])}`)
    .join("&");
  const stringToSign = `GET&${aliyunPercentEncode("/")}&${aliyunPercentEncode(canonicalized)}`;
  const signature = createAliyunHmacSha1(`${args.accessKeySecret}&`, stringToSign);
  const query = `${canonicalized}&${aliyunPercentEncode("Signature")}=${aliyunPercentEncode(signature)}`;
  return `https://dysmsapi.aliyuncs.com/?${query}`;
}

function aliyunPercentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

/** HMAC-SHA1 薄封装：便于单测注入，生产走 node:crypto。 */
export function createAliyunHmacSha1(key: string, message: string): string {
  return createHmac("sha1", key).update(message, "utf8").digest("base64");
}

/** 腾讯云短信通道（sms.tencentcloudapi.com，无凭证快速失败）。 */
export function buildTencentSmsChannel(): IVendorChannel<SmsDispatchInput, SmsDispatchOutput> {
  return {
    vendor: "TENCENT",
    priority: 2,
    timeoutMs: 5_000,
    execute: async (input) => {
      const secretId = process.env.TENCENT_SMS_SECRET_ID;
      const secretKey = process.env.TENCENT_SMS_SECRET_KEY;
      if (!secretId || !secretKey) throw new Error("TENCENT sms key missing");
      const res = await fetch("https://sms.tencentcloudapi.com/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Action: "SendSms",
          Version: "2021-01-11",
          SecretId: secretId,
          SmsSdkAppId: process.env.TENCENT_SMS_SDK_APP_ID ?? "",
          SignName: input.signName ?? "DealProtocol",
          TemplateId: input.templateCode ?? "SMS_EMERGENCY",
          TemplateParamSet: [input.content],
          PhoneNumberSet: [`+86${input.phone}`],
        }),
      });
      if (!res.ok) throw new Error(`TENCENT sms http ${res.status}`);
      const data = (await res.json()) as { Response?: { SendStatusSet?: Array<{ SerialNo?: string }> } };
      return { success: true, messageId: data.Response?.SendStatusSet?.[0]?.SerialNo };
    },
  };
}

/** 华为云短信通道（msgsms 北向接口，无凭证快速失败）。 */
export function buildHuaweiSmsChannel(): IVendorChannel<SmsDispatchInput, SmsDispatchOutput> {
  return {
    vendor: "HUAWEI",
    priority: 3,
    timeoutMs: 5_000,
    execute: async (input) => {
      const appKey = process.env.HUAWEI_SMS_APP_KEY;
      const appSecret = process.env.HUAWEI_SMS_APP_SECRET;
      const sender = process.env.HUAWEI_SMS_SENDER;
      if (!appKey || !appSecret || !sender) throw new Error("HUAWEI sms key missing");
      const res = await fetch(
        `https://smsapi.cn-north-4.myhuaweicloud.com:443/sms/batchSendSms/v1`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            from: sender,
            to: input.phone,
            templateId: input.templateCode ?? "SMS_EMERGENCY",
            templateParas: JSON.stringify([input.title, input.content]),
            signature: input.signName ?? "DealProtocol",
          }).toString(),
        },
      );
      if (!res.ok) throw new Error(`HUAWEI sms http ${res.status}`);
      const data = (await res.json()) as { result?: Array<{ smsgId?: string }> };
      return { success: true, messageId: data.result?.[0]?.smsgId };
    },
  };
}

/** 本地 Mock 存根（红线 1 确定性兜底：无网络/欠费/超限时转站内通知日志）。 */
export function buildLocalSmsMockChannel(): IVendorChannel<SmsDispatchInput, SmsDispatchOutput> {
  return {
    vendor: "LOCAL_MOCK",
    priority: 99,
    timeoutMs: 1_000,
    execute: async (input) => {
      // 站内通知/日志存根：任何环境均可执行，永不抛错
      return { success: true, messageId: `mock-${input.phone}-${Date.now()}` };
    },
  };
}

/** 短信热备门面：阿里云 → 腾讯云 → 华为云 → 本地 Mock。 */
export async function dispatchSmsWithFallback(
  input: SmsDispatchInput,
  channelKey = "sms",
  channels?: IVendorChannel<SmsDispatchInput, SmsDispatchOutput>[],
): Promise<FallbackResult<SmsDispatchOutput>> {
  const list = channels ?? [
    buildAliyunSmsChannel(),
    buildTencentSmsChannel(),
    buildHuaweiSmsChannel(),
    buildLocalSmsMockChannel(),
  ];
  return executeWithFallback(list, input, channelKey);
}

// ---------- LBS 距离 / 逆地理多通道热备门面 ----------

import type {
  LbsDistanceInput,
  LbsDistanceOutput,
} from "@/base/geo/lbs-port.ts";
import { haversineMeters } from "@/base/geo/lbs-port.ts";

export type { LbsDistanceInput, LbsDistanceOutput };

/** 本地 Haversine 纯数学兜底（与 base/geo/geo.ts 同一地球模型，本地零依赖）。 */
// haversineMeters 纯数学已收敛至 base/geo/lbs-port（六边形端口）。

/** 本地确定性距离通道（永不失败）。 */
export function buildLocalHaversineChannel(): IVendorChannel<LbsDistanceInput, LbsDistanceOutput> {
  return {
    vendor: "LOCAL_MOCK",
    priority: 99,
    timeoutMs: 1_000,
    execute: async (input) => ({ distanceMeters: haversineMeters(input.a, input.b) }),
  };
}

/** MapLibre / OpenFreeMap 通道（免费瓦片源无 Key，作为地图类首选；无能力快速失败）。 */
export function buildOpenFreeMapChannel(): IVendorChannel<LbsDistanceInput, LbsDistanceOutput> {
  return {
    vendor: "OPEN_FREE_MAP",
    priority: 1,
    timeoutMs: 4_000,
    execute: async () => {
      // OpenFreeMap 为瓦片渲染源，不提供测距 API；走渲染管线时测距能力缺省
      // 快速失败，平滑下跳至高德/腾讯 WebService（宪法 #10 不假造外部依赖）。
      throw new Error("OPEN_FREE_MAP no distance api");
    },
  };
}

/** 高德 WebService 测距通道（restapi.amap.com v3/distance，无 key 快速失败）。 */
export function buildAmapChannel(): IVendorChannel<LbsDistanceInput, LbsDistanceOutput> {
  return {
    vendor: "AMAP",
    priority: 2,
    timeoutMs: 4_000,
    execute: async (input) => {
      const key = process.env.AMAP_WEB_API_KEY;
      if (!key) throw new Error("AMAP key missing");
      const url =
        `https://restapi.amap.com/v3/distance?key=${key}` +
        `&origins=${input.a.lng},${input.a.lat}` +
        `&destination=${input.b.lng},${input.b.lat}&type=1`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`AMAP http ${res.status}`);
      const data = (await res.json()) as { status?: string; results?: Array<{ distance?: string }> };
      if (data.status !== "1") throw new Error(`AMAP api ${data.status}`);
      const meters = Number(data.results?.[0]?.distance);
      if (!Number.isFinite(meters)) throw new Error("AMAP no distance");
      return { distanceMeters: Math.round(meters * 100) / 100 };
    },
  };
}

/** 腾讯地图 WebService 测距通道（apis.map.qq.com distance/matrix，无 key 快速失败）。 */
export function buildTencentLbsChannel(): IVendorChannel<LbsDistanceInput, LbsDistanceOutput> {
  return {
    vendor: "TENCENT",
    priority: 3,
    timeoutMs: 4_000,
    execute: async (input) => {
      const key = process.env.TENCENT_LBS_KEY;
      if (!key) throw new Error("TENCENT lbs key missing");
      const url =
        `https://apis.map.qq.com/ws/distance/v1/matrix?key=${key}` +
        `&mode=driving&from=${input.a.lat},${input.a.lng}` +
        `&to=${input.b.lat},${input.b.lng}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`TENCENT lbs http ${res.status}`);
      const data = (await res.json()) as { status?: number; result?: { rows?: Array<{ elements?: Array<{ distance?: number }> }> } };
      if (data.status !== 0) throw new Error(`TENCENT lbs api ${data.status}`);
      const meters = data.result?.rows?.[0]?.elements?.[0]?.distance;
      if (typeof meters !== "number" || !Number.isFinite(meters)) throw new Error("TENCENT lbs no distance");
      return { distanceMeters: Math.round(meters * 100) / 100 };
    },
  };
}

/** LBS 距离热备门面：MapLibre/OpenFreeMap → 高德 → 腾讯 → 本地 Haversine。 */
export async function calculateDistanceWithFallback(
  input: LbsDistanceInput,
  channelKey = "lbs-distance",
  channels?: IVendorChannel<LbsDistanceInput, LbsDistanceOutput>[],
): Promise<FallbackResult<LbsDistanceOutput>> {
  const list = channels ?? [
    buildOpenFreeMapChannel(),
    buildAmapChannel(),
    buildTencentLbsChannel(),
    buildLocalHaversineChannel(),
  ];
  return executeWithFallback(list, input, channelKey);
}
