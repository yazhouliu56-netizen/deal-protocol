import { getServiceClient } from "@/lib/supabase-client";

/**
 * 团伙规则库（P2-b 只做实名之后 · 用户裁决 2026-09-26：1 刷单互刷＋2 马甲都要防）。
 *
 * 姿态：确定性规则先行（LLM 聚类后上，已排）；DB 异常一律放行＋日志
 * （可用性优先，ETA 快照先例；service 通道本身可靠，异常≈短暂抖动）。
 * R1 互刷环：同对 30 天已结算 ≥3 → 拦截＋metric 旗（K/窗口用户拍板值）。
 * R2 马甲撞库：身份证哈希同证多号 → 拒绝后绑（无人工列队，提示用原号）。
 * 见面安全包：首单或入户（C2 集群）→ 双向安全须知＋metric（零 DDL/UI 改动）。
 */

export const MUTUAL_BRUSH_THRESHOLD = 3;
export const MUTUAL_BRUSH_WINDOW_DAYS = 30;

type Svc = ReturnType<typeof getServiceClient>;

async function flagMetric(
  svc: Svc,
  name: string,
  value: number,
  tags: Record<string, string>,
): Promise<void> {
  try {
    await svc.from("metric_events").insert({ name, value, tags });
  } catch {
    /* 遥测失败不阻断主流程 */
  }
}

/** R1：同对 30 天已结算数达阈值即互刷嫌疑（调用方据此 409）。 */
export async function checkMutualBrushPair(
  svc: Svc,
  customerId: string,
  providerId: string,
  nowMs: number = Date.now(),
): Promise<{ hit: boolean; count: number }> {
  try {
    const cutoff = new Date(nowMs - MUTUAL_BRUSH_WINDOW_DAYS * 86400_000).toISOString();
    const { data, error } = await svc
      .from("contracts")
      .select("id")
      .eq("customer_id", customerId)
      .eq("provider_id", providerId)
      .eq("fund_status", "SETTLED")
      .gte("updated_at", cutoff)
      .limit(MUTUAL_BRUSH_THRESHOLD);
    if (error) throw error;
    const count = (data as unknown[] | null)?.length ?? 0;
    const hit = count >= MUTUAL_BRUSH_THRESHOLD;
    if (hit) {
      await flagMetric(svc, "risk.mutual_brush_flag", count, {
        customer: customerId,
        provider: providerId,
      });
    }
    return { hit, count };
  } catch (e) {
    console.warn("[gang-rules] R1 检查异常，放行：", e instanceof Error ? e.message : e);
    return { hit: false, count: 0 };
  }
}

/** R2：同证多号（排除本人行）。返回撞车的用户 id，无则 null。 */
export async function findIdCollision(
  svc: Svc,
  idHash: string,
  selfId: string,
): Promise<string | null> {
  try {
    const { data, error } = await svc
      .from("profiles")
      .select("id")
      .eq("id_number_hash", idHash)
      .neq("id", selfId)
      .limit(1);
    if (error) throw error;
    const hit = ((data ?? []) as { id?: string }[])[0]?.id ?? null;
    if (hit) {
      await flagMetric(svc, "risk.id_collision", 1, { owner: hit, reporter: selfId });
    }
    return hit;
  } catch (e) {
    console.warn("[gang-rules] R2 检查异常，放行：", e instanceof Error ? e.message : e);
    return null;
  }
}

export interface MeetupSafetyInput {
  /** 师傅历史完单数是否为 0（首单）。 */
  isFirstOrder: boolean;
  /** 弹药供给集群（C2_IN_HOME＝入户重背调类）。 */
  supplyCluster?: string;
}

/** 见面安全包判定：首单或入户即触达（reasons 留痕进 metric）。 */
export function meetupSafetyPackage(input: MeetupSafetyInput): {
  send: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (input.isFirstOrder) reasons.push("first-order");
  if (input.supplyCluster === "C2_IN_HOME") reasons.push("home-access");
  return { send: reasons.length > 0, reasons };
}
