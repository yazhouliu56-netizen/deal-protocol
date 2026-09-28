import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";

/**
 * GET /api/cron/guard-booking（R-0928-12 BOOKED 到期推进兜底）：
 * CRON_SECRET 自证节拍。将开始时间已到的 BOOKED 批量转 OPEN
 * （热路径读 effectiveDemandStatus 不等 cron，此处只做写回兜底）。
 */
const BATCH = 200;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const svc = getServiceClient();
  const nowIso = new Date().toISOString();
  try {
    const { data, error } = await (svc.from("demands") as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          lte: (col: string, val: string) => {
            limit: (n: number) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
          };
        };
      };
    })
      .select("id")
      .eq("status", "BOOKED")
      .lte("timeslot_start", nowIso)
      .limit(BATCH);
    if (error) return NextResponse.json({ checked: 0, opened: 0, errors: [error.message] }, { status: 200 });
    const ids = (data ?? []).map((r) => r.id);
    let opened = 0;
    const errors: string[] = [];
    for (const id of ids) {
      try {
        const { error: upErr } = await (svc.from("demands") as unknown as {
          update: (row: Record<string, unknown>) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        })
          .update({ status: "OPEN" })
          .eq("id", id)
          .eq("status", "BOOKED");
        if (upErr) errors.push(`${id}: ${upErr.message}`);
        else opened += 1;
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.message : "update failed"}`);
      }
    }
    return NextResponse.json({ checked: ids.length, opened, errors: errors.slice(0, 10) }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { checked: 0, opened: 0, errors: [err instanceof Error ? err.message : "fetch failed"] },
      { status: 200 },
    );
  }
}
