import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";
import { isRetentionExpired, type RecordingTier, type TerminalKind } from "@/base/safe/recording";
import { findOpenDispute } from "@/app/api/guard/recording/guard-get";

/**
 * GET /api/cron/guard-retention（R-0928-09 留存矩阵执行）：
 * CRON_SECRET 自证节拍。扫描 RECORDING_SEALED 锚，到期即删音频字节＋
 * 锚行标记 purged（元数据与哈希链保留，不断链；payload_ref 仍可审计）。
 * Tage 含义：clean 无纠纷终局 / disputed 有 OPEN 立案 / tampered 预留
 * （TAMPER 否决事件尚未持久化，另路）。
 */
const BUCKET = "guard-recordings";
const BATCH = 200;

interface AnchorRow {
  id: string;
  payload: {
    demandId?: string | null;
    tier?: string;
  } | null;
  payload_ref: string | null;
  created_at: string;
}

function tierOf(payload: AnchorRow["payload"]): RecordingTier | null {
  const t = payload?.tier;
  return t === "A" || t === "B" || t === "C" ? t : null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const svc = getServiceClient();
  const nowMs = Date.now();
  let checked = 0;
  let purged = 0;
  const errors: string[] = [];

  let anchors: AnchorRow[] = [];
  try {
    const { data, error } = await (svc.from("evidence_log") as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: AnchorRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    })
      .select("id, payload, payload_ref, created_at")
      .eq("event_type", "RECORDING_SEALED")
      .order("created_at", { ascending: true })
      .limit(BATCH);
    if (error) return NextResponse.json({ checked: 0, purged: 0, errors: [error.message] }, { status: 200 });
    anchors = data ?? [];
  } catch (err) {
    return NextResponse.json(
      { checked: 0, purged: 0, errors: [err instanceof Error ? err.message : "fetch failed"] },
      { status: 200 },
    );
  }

  for (const a of anchors) {
    checked += 1;
    const tier = tierOf(a.payload);
    const demandId = a.payload?.demandId ?? null;
    if (!tier || !a.payload_ref) continue;
    let terminal: TerminalKind = "clean";
    if (demandId) {
      try {
        // TAMPER 否决优先于立案口径（断链信号留最久）。
        const { data: tamper } = await (svc.from("evidence_log") as unknown as {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: string) => {
                limit: (n: number) => Promise<{ data: { id: string }[] | null }>;
              };
            };
          };
        })
          .select("id")
          .eq("event_type", "RECORDING_TAMPER_DENIED")
          .eq("payload->>demandId", demandId)
          .limit(1);
        if (tamper && tamper.length > 0) {
          terminal = "tampered";
        } else {
          const open = await findOpenDispute(
            svc as unknown as Parameters<typeof findOpenDispute>[0],
            demandId,
          );
          if (open) terminal = "disputed";
        }
      } catch {
        /* 查不到按 clean（宁可晚删，不可误删） */
      }
    }
    const sealedMs = Date.parse(a.created_at);
    if (!isRetentionExpired(sealedMs, tier, terminal, nowMs)) continue;
    try {
      const objectPath = a.payload_ref.startsWith(`${BUCKET}/`)
        ? a.payload_ref.slice(BUCKET.length + 1)
        : a.payload_ref;
      const { error: rmErr } = await (svc.storage.from(BUCKET) as unknown as {
        remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
      }).remove([objectPath]);
      if (rmErr) {
        errors.push(`remove ${a.id}: ${rmErr.message}`);
        continue;
      }
      const { error: upErr } = await (svc.from("evidence_log") as unknown as {
        update: (row: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      })
        .update({ payload: { ...(a.payload ?? {}), purged: true, purgedAt: new Date(nowMs).toISOString() } })
        .eq("id", a.id);
      if (upErr) {
        errors.push(`mark ${a.id}: ${upErr.message}`);
        continue;
      }
      purged += 1;
    } catch (err) {
      errors.push(`${a.id}: ${err instanceof Error ? err.message : "purge failed"}`);
    }
  }

  return NextResponse.json({ checked, purged, errors: errors.slice(0, 10) }, { status: 200 });
}
