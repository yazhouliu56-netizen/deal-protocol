import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getServiceClient } from "@/lib/supabase-client";
import { checkGuardMembership } from "@/lib/guard-watch";

/**
 * POST /api/guard/recording（R-0928-08/09）：
 * 一键录音落盘。multipart：file（audio/*，≤10MB）＋ demandId? ＋ tier ＋ startedAtMs?。
 * 服务端算 SHA-256（客户端预指纹不可信，SOS P1-3 同制）→ 私有桶
 * guard-recordings → evidence_log 锚（order_id 置空避 orders FK，
 * demandId 进 payload；哈希链续接同 demand 上一锚，查不到回 GENESIS）。
 * C 档禁音 → 403；解密条件见 R-0928-09（纠纷立案，另路）。
 */
const BUCKET = "guard-recordings";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/x-m4a"];

export const POST = withAuth(async (req, user) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "非法请求体（需 multipart）" }, { status: 400 });
  }

  const tier = form.get("tier");
  if (tier === "C") {
    return NextResponse.json({ error: "C 档禁音：未成年人相关只留 GPS 与文字" }, { status: 403 });
  }
  if (tier !== "A" && tier !== "B") {
    return NextResponse.json({ error: "缺少合法 tier（A/B）" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "缺少录音文件" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "录音超限（10MB）" }, { status: 400 });
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: `不支持的音频格式（${file.type}）` }, { status: 400 });
  }

  const rawDemand = form.get("demandId");
  const demandId = typeof rawDemand === "string" && rawDemand.trim() !== "" ? rawDemand.trim() : null;
  if (demandId) {
    const route = await getRouteClient();
    const { ok } = await checkGuardMembership(route, demandId, user.id);
    if (!ok) {
      return NextResponse.json({ error: "仅履约双方可上传守护录音" }, { status: 403 });
    }
  }

  const startedRaw = form.get("startedAtMs");
  const startedAtMs = typeof startedRaw === "string" && startedRaw.trim() !== "" ? Number(startedRaw) : null;

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const ext = file.type === "audio/mp4" || file.type === "audio/x-m4a" ? "m4a" : file.type === "audio/mpeg" ? "mp3" : file.type === "audio/ogg" ? "ogg" : "webm";
  const storagePath = `${demandId ?? "personal"}/${user.id}/${Date.now()}.${ext}`;

  const svc = getServiceClient();
  try {
    const { error: upErr } = await svc.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type || "audio/webm", upsert: false });
    if (upErr) {
      return NextResponse.json({ error: `录音上传失败：${upErr.message}` }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: `录音上传失败：${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 },
    );
  }

  // 哈希链续接（best-effort；查不到回 GENESIS，不断流）。
  let prevHash = "GENESIS";
  if (demandId) {
    try {
      const { data } = await (svc.from("evidence_log") as unknown as {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: { hash: string }[] | null }>;
            };
          };
        };
      })
        .select("hash")
        .eq("payload->>demandId", demandId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data[0]?.hash) prevHash = data[0].hash;
    } catch {
      /* 回 GENESIS */
    }
  }

  try {
    const { error: anchorErr } = await (svc.from("evidence_log") as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).insert({
      order_id: null,
      event_type: "RECORDING_SEALED",
      payload: {
        demandId,
        tier,
        startedAtMs,
        mime: file.type || "audio/webm",
        bytes: bytes.length,
      },
      payload_ref: `${BUCKET}/${storagePath}`,
      captured_by: user.id,
      hash,
      prev_hash: prevHash,
    });
    if (anchorErr) {
      return NextResponse.json({ error: `存证锚定失败：${anchorErr.message}` }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: `存证锚定失败：${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, path: `${BUCKET}/${storagePath}`, hash, bytes: bytes.length, prevHash },
    { status: 200 },
  );
});
