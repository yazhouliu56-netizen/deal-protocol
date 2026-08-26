/**
 * 订单详情/状态跃迁 API 主入口（P2-7 巨石控制器瘦身 · 战役 5）。
 *
 * 职责仅剩 HTTP 壳委托——业务逻辑分治于同目录私有模块：
 * - GET  → _handlers/order-read.ts（详情装配 + auto-complete 幂等检查）
 * - PATCH → _handlers/order-patch.ts（引擎校验 → 支付(PaymentRegistry) /
 *          退款 / 争议三动作 → CAS 写回 → 存证事件通知）
 *
 * 外部 HTTP 响应契约与状态码 100% 守恒（645 行巨石 → 委托壳）。
 */
import { handleOrderRead } from "./_handlers/order-read";
import { handleOrderPatch } from "./_handlers/order-patch";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleOrderRead(request, { params });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleOrderPatch(request, { params });
}
