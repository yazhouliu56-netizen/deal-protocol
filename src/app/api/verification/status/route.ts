import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

/**
 * 实名进度读口（P2-b wizard 数据源）：手机戳＋身份证件＋人脸件＋终态。
 * 迁移未应用（42703）→ 503，调用方回落旧单表（部署偏斜期不断流）。
 */
export const GET = withAuth(async (_req, user) => {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from("profiles")
    .select(
      "verification_status, verification_rejected_reason, phone_verified_at, verification_id_number, face_verified_at",
    )
    .eq("id", user.id)
    .single();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42703") {
      return NextResponse.json({ error: "migration-pending" }, { status: 503 });
    }
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
  const p = (data ?? {}) as {
    verification_status?: string;
    verification_rejected_reason?: string | null;
    phone_verified_at?: string | null;
    verification_id_number?: string | null;
    face_verified_at?: string | null;
  };
  return NextResponse.json({
    status: p.verification_status ?? "unverified",
    rejectedReason: p.verification_rejected_reason ?? null,
    phoneDone: p.phone_verified_at != null,
    idDone: p.verification_id_number != null,
    faceDone: p.face_verified_at != null,
  });
});
