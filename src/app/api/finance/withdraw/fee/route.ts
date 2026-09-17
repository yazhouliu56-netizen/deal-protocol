import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getConfig } from "@/lib/platform/config";
import { withdrawFee } from "@/lib/channel-fee";

/**
 * P8 提现通道费试算（用户裁决 2026-09-18：从到账扣，微信提现同逻辑）。
 * Modal 展示用；服务端在审核通过时重算（不信任客户端）。
 */
export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const amount = Number(searchParams.get("amount") ?? 0);
  const method = (searchParams.get("method") ?? "ALIPAY").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "金额非法" }, { status: 400 });
  }
  const cfg = await getConfig();
  const r = withdrawFee(method, amount, cfg.fees.channelRates?.alipay ?? 0, cfg.fees.withdrawBankFlat ?? 2);
  return NextResponse.json({ amount, method, ...r });
});
