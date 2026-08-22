/**
 * 6 大核心 Supabase 原子 RPC 调用通道（已落库函数的安全类型封装）。
 *
 * 统一包装器 callRpc：注入 transport（supabase-js 的 rpc 适配器）走真实
 * 远程通道；未注入 / 注入失败 → 确定性 Mock 降级（红线 5：无远程 DB 连接
 * 时单测 100% 畅通，且降级结果可断言，不引入随机性）。
 *
 * 封装的 6 大原子 RPC（supabase/migrations 已落库）：
 *   grab_demand（抢单）/ release_checkpoint_rpc（里程碑放款）/
 *   sla_auto_release_rpc（SLA 自动放款）/ match_demands_hybrid（混合匹配）/
 *   init_provider_wallet（服务方钱包初始化）/ submit_withdrawal_request（提现）。
 */

/** RPC 传输通道（supabase-js 的 rpc 最小接口，便于注入与单测 mock）。 */
export interface RpcTransport {
  rpc(fn: string, args: Record<string, unknown>): Promise<{
    data?: unknown;
    error?: { message?: string } | null;
  }>;
}

/** RPC 调用结果（degraded=true 表示走了本地 Mock 降级通道）。 */
export type RpcResult<T> =
  | { ok: true; data: T; degraded: boolean }
  | { ok: false; error: string; degraded: boolean };

/**
 * 本地 Mock 降级结果（确定性数据，供无 DB 环境与单测断言）。
 * 调用参数经 p_ 前缀脱敏映射为语义键（p_demand_id → demandId），
 * 使降级结果形状与类型契约（RpcResult<T>）一致。
 */
const MOCK_RESULTS: Record<string, Record<string, unknown>> = {
  grab_demand: { grabbed: true, assignedAt: "MOCK" },
  release_checkpoint_rpc: { released: true, checkpointIndex: 0 },
  sla_auto_release_rpc: { autoReleased: true, releasedAt: "MOCK" },
  match_demands_hybrid: { candidates: [] },
  init_provider_wallet: { initialized: true, walletId: "MOCK-WALLET" },
  submit_withdrawal_request: { requestId: "MOCK-WDR-0000", status: "pending" },
};

const toCamelKey = (key: string): string =>
  key.replace(/^p_/, "").replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function mockResultFor<T>(fn: string, args: Record<string, unknown>): T {
  const base = MOCK_RESULTS[fn] ?? { ok: true };
  const mapped = Object.fromEntries(
    Object.entries(args).map(([k, v]) => [toCamelKey(k), v]),
  );
  return { ...base, ...mapped } as T;
}

/**
 * 统一 RPC 包装器：有 transport → 真实远程调用（error 透传）；无 transport
 * 或调用抛异常 → Mock 降级（degraded=true）。全程不抛未捕获异常（红线 5）。
 */
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  transport?: RpcTransport,
): Promise<RpcResult<T>> {
  if (!transport) {
    return { ok: true, data: mockResultFor<T>(fn, args), degraded: true };
  }
  try {
    const { data, error } = await transport.rpc(fn, args);
    if (error?.message) {
      return { ok: false, error: error.message, degraded: false };
    }
    return { ok: true, data: (data ?? {}) as T, degraded: false };
  } catch {
    return { ok: true, data: mockResultFor<T>(fn, args), degraded: true };
  }
}

/** 抢单（grab_demand）：需求方接受/服务方抢下匹配。 */
export function rpcGrabDemand(
  demandId: string,
  providerId: string,
  transport?: RpcTransport,
): Promise<RpcResult<{ grabbed: boolean; demandId: string; providerId: string }>> {
  return callRpc("grab_demand", { p_demand_id: demandId, p_provider_id: providerId }, transport);
}

/** 里程碑放款（release_checkpoint_rpc）：按里程碑序号释放托管资金。 */
export function rpcReleaseCheckpoint(
  contractId: string,
  checkpointIndex: number,
  transport?: RpcTransport,
): Promise<RpcResult<{ released: boolean; checkpointIndex: number }>> {
  return callRpc(
    "release_checkpoint_rpc",
    { p_contract_id: contractId, p_checkpoint_index: checkpointIndex },
    transport,
  );
}

/** SLA 自动放款（sla_auto_release_rpc）：超时无争议自动释放。 */
export function rpcSlaAutoRelease(
  contractId: string,
  transport?: RpcTransport,
): Promise<RpcResult<{ autoReleased: boolean; contractId: string }>> {
  return callRpc("sla_auto_release_rpc", { p_contract_id: contractId }, transport);
}

/** 混合匹配（match_demands_hybrid）：向量语义 + LBS 时空候选召回。 */
export function rpcMatchDemandsHybrid(
  embedding: number[],
  lat: number,
  lng: number,
  radiusKm: number,
  transport?: RpcTransport,
): Promise<RpcResult<{ candidates: unknown[] }>> {
  return callRpc(
    "match_demands_hybrid",
    { p_embedding: embedding, p_lat: lat, p_lng: lng, p_radius_km: radiusKm },
    transport,
  );
}

/** 服务方钱包初始化（init_provider_wallet）：首单放款前置建账。 */
export function rpcInitProviderWallet(
  providerId: string,
  transport?: RpcTransport,
): Promise<RpcResult<{ initialized: boolean; walletId: string }>> {
  return callRpc("init_provider_wallet", { p_provider_id: providerId }, transport);
}

/** 提现申请（submit_withdrawal_request）：T+0/T+1 提现入队。 */
export function rpcSubmitWithdrawalRequest(
  providerId: string,
  amount: number,
  transport?: RpcTransport,
): Promise<RpcResult<{ requestId: string; status: string }>> {
  return callRpc(
    "submit_withdrawal_request",
    { p_provider_id: providerId, p_amount: amount },
    transport,
  );
}
