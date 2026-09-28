import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getServiceClient } from "@/lib/supabase-client";
import { checkGuardMembership } from "@/lib/guard-watch";

/**
 * GET /api/guard/recording（R-0928-09 立案解密＋展开审计）三模式：
 * - ?path=guard-recordings/... → 回放：仅 OPEN 立案争议可听，签发 60s 私有 URL，
 *   每次访问记 RECORDING_ACCESSED 审计锚；
 * - ?demandId= → 列表：履约双方可见锚元数据（无 URL）；
 * - ?disputeId= → 列表：争议→合同→需求解析后同上（仲裁抽屉用）。
 */
const BUCKET = "guard-recordings";

type SvcLike = {
  from: (table: string) => unknown;
  storage: { from: (bucket: string) => unknown };
};

interface AnchorRow {
  hash: string;
  payload: {
    demandId?: string | null;
    tier?: string;
    startedAtMs?: number | null;
    mime?: string;
    bytes?: number;
  } | null;
  payload_ref: string | null;
  captured_by: string | null;
  created_at: string;
}

async function readAnchor(svc: SvcLike, ref: string): Promise<AnchorRow | null> {
  try {
    const { data } = await (svc.from("evidence_log") as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          limit: (n: number) => Promise<{ data: AnchorRow[] | null }>;
        };
      };
    })
      .select("hash, payload, payload_ref, captured_by, created_at")
      .eq("payload_ref", ref)
      .limit(1);
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

async function listAnchors(svc: SvcLike, demandId: string): Promise<AnchorRow[]> {
  try {
    const { data } = await (svc.from("evidence_log") as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: AnchorRow[] | null }>;
            };
          };
        };
      };
    })
      .select("hash, payload, payload_ref, captured_by, created_at")
      .eq("event_type", "RECORDING_SEALED")
      .eq("payload->>demandId", demandId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []).filter((r) => !(r.payload as { purged?: boolean } | null)?.purged);
  } catch {
    return [];
  }
}

async function resolveDemandByDispute(
  svc: SvcLike,
  disputeId: string,
): Promise<{ demandId: string | null; dispute: { id: string; status: string } | null }> {
  try {
    const disputes = svc.from("disputes") as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          limit: (n: number) => Promise<{ data: { id: string; contract_id: string; status: string }[] | null }>;
        };
      };
    };
    const contracts = svc.from("contracts") as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          limit: (n: number) => Promise<{ data: { id: string; demand_id: string }[] | null }>;
        };
      };
    };
    let dispute: { id: string; contract_id: string; status: string } | null = null;
    const byContract = await disputes.select("id, contract_id, status").eq("contract_id", disputeId).limit(1);
    dispute = byContract.data?.[0] ?? null;
    if (!dispute) return { demandId: null, dispute: null };
    const c = await contracts.select("id, demand_id").eq("id", dispute.contract_id).limit(1);
    const demandId = c.data?.[0]?.demand_id ?? null;
    return { demandId, dispute: { id: dispute.id, status: dispute.status } };
  } catch {
    return { demandId: null, dispute: null };
  }
}

export async function findOpenDispute(
  svc: SvcLike,
  demandId: string,
): Promise<{ id: string } | null> {
  try {
    const contracts = svc.from("contracts") as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          limit: (n: number) => Promise<{ data: { id: string }[] | null }>;
        };
      };
    };
    const disputes = svc.from("disputes") as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            limit: (n: number) => Promise<{ data: { id: string }[] | null }>;
          };
        };
      };
    };
    const c = await contracts.select("id").eq("demand_id", demandId).limit(1);
    const contractId = c.data?.[0]?.id;
    if (!contractId) return null;
    const d = await disputes.select("id").eq("contract_id", contractId).eq("status", "OPEN").limit(1);
    return d.data?.[0] ?? null;
  } catch {
    return null;
  }
}

async function auditAccess(svc: SvcLike, ref: string, by: string, disputeId: string | null) {
  try {
    await (svc.from("evidence_log") as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
    }).insert({
      order_id: null,
      event_type: "RECORDING_ACCESSED",
      payload: { ref, disputeId },
      payload_ref: ref,
      captured_by: by,
      hash: "audit",
      prev_hash: "GENESIS",
    });
  } catch {
    /* 审计失败不阻断回放（已尽力留痕，调用方日志另记） */
  }
}

function toListItem(r: AnchorRow) {
  return {
    createdAt: r.created_at,
    tier: r.payload?.tier ?? null,
    bytes: r.payload?.bytes ?? null,
    mime: r.payload?.mime ?? null,
    hash: r.hash,
    ref: r.payload_ref,
  };
}

export const GET = withAuth(async (req, user) => {
  const params = new URL(req.url).searchParams;
  const path = params.get("path")?.trim() ?? "";
  const demandParam = params.get("demandId")?.trim() ?? "";
  const disputeParam = params.get("disputeId")?.trim() ?? "";
  const svc = getServiceClient() as unknown as SvcLike;

  // —— 回放模式 ——
  if (path !== "") {
    if (!path.startsWith(`${BUCKET}/`)) {
      return NextResponse.json({ error: "非法录音路径" }, { status: 400 });
    }
    const anchor = await readAnchor(svc, path);
    if (!anchor) {
      return NextResponse.json({ error: "录音不存在或已销毁" }, { status: 404 });
    }
    const demandId = anchor.payload?.demandId ?? null;
    if (!demandId) {
      return NextResponse.json({ error: "个人自保录音仅本人可听" }, { status: 403 });
    }
    const route = await getRouteClient();
    const { ok } = await checkGuardMembership(route, demandId, user.id);
    if (!ok) {
      return NextResponse.json({ error: "仅履约双方可听" }, { status: 403 });
    }
    // 立案门：存在 OPEN 争议才解密（R-0928-09）。
    const open = await findOpenDispute(svc, demandId);
    if (!open) {
      return NextResponse.json({ error: "需纠纷立案后才可回放", code: "DISPUTE_REQUIRED" }, { status: 403 });
    }
    await auditAccess(svc, path, user.id, open.id);
    try {
      const { data, error } = await (svc.storage.from(BUCKET) as unknown as {
        createSignedUrl: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
      }).createSignedUrl(path.slice(BUCKET.length + 1), 60);
      if (error || !data) {
        return NextResponse.json({ error: `签发失败：${error?.message ?? "unknown"}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, url: data.signedUrl, expiresIn: 60 }, { status: 200 });
    } catch (err) {
      return NextResponse.json(
        { error: `签发失败：${err instanceof Error ? err.message : "unknown"}` },
        { status: 500 },
      );
    }
  }

  // —— 列表模式 ——
  let demandId: string | null = demandParam !== "" ? demandParam : null;
  if (!demandId && disputeParam !== "") {
    const resolved = await resolveDemandByDispute(svc, disputeParam);
    demandId = resolved.demandId;
    if (!demandId) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200 });
    }
  }
  if (!demandId) {
    return NextResponse.json({ error: "缺少 path / demandId / disputeId" }, { status: 400 });
  }
  const route = await getRouteClient();
  const { ok } = await checkGuardMembership(route, demandId, user.id);
  if (!ok) {
    return NextResponse.json({ error: "仅履约双方可查看" }, { status: 403 });
  }
  const items = (await listAnchors(svc, demandId)).map(toListItem);
  return NextResponse.json({ ok: true, items }, { status: 200 });
});
