import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"
import { configurePiiEncryptionKey, encryptPII } from "@/base/safe/pii-crypto"
import { verifyFaceLiveness, verifyThreeElements } from "@/base/platform/realname-verify"
import { createHash } from "crypto"

// Microkernel 2.0 战役 2：密钥组合根注入（底座零 env）
if (process.env.PII_ENCRYPTION_KEY) {
  configurePiiEncryptionKey(process.env.PII_ENCRYPTION_KEY);
}

/**
 * P2-b 只做实名（渐进式＋全自动，零人工审核）：
 * 姓名/身份证/人脸照可分次提交（缺一即 400 指名，不拦其它件）；
 * 件件过 vendor（缺 key 回落 Mock）；齐活即系统直批 approved（reviewed_by system）；
 * 硬失败判 rejected 可重提（pending 不再是死胡同）；approved 挡重复提交。
 * 身份证归一化 SHA-256 落 id_number_hash（R2 同证多号撞库键；密文随机 IV 不可比）。
 */
export const POST = withAuth(async (req, user) => {
  const { realName, idNumber, certificates, faceImageUrl } = await req.json()
  const svc = getServiceClient()

  const { data: profile, error: fetchError } = await svc
    .from("profiles")
    .select("verification_status, phone, phone_verified_at, verification_id_number, id_number_hash, face_image_url, face_verified_at")
    .eq("id", user.id)
    .single()

  if (fetchError || !profile) {
    const code = (fetchError as { code?: string } | null)?.code;
    if (code === "42703") {
      return NextResponse.json(
        { error: "实名升级迁移未应用，请联系管理员执行 20260926 收编迁移" },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "查询用户失败" }, { status: 500 })
  }
  const p = profile as {
    verification_status?: string;
    phone?: string | null;
    phone_verified_at?: string | null;
    verification_id_number?: string | null;
    id_number_hash?: string | null;
    face_image_url?: string | null;
    face_verified_at?: string | null;
  }

  if (p.verification_status === "approved") {
    return NextResponse.json(
      { error: "您已通过实名认证，无需重复提交" },
      { status: 400 },
    )
  }

  const updates: Record<string, unknown> = {
    verification_rejected_reason: null,
    verification_submitted_at: new Date().toISOString(),
  }
  const wantName = realName !== undefined && realName !== null && realName !== "";
  const wantId = idNumber !== undefined && idNumber !== null && idNumber !== "";
  const wantFace = faceImageUrl !== undefined && faceImageUrl !== null && faceImageUrl !== "";
  const wantCerts = certificates !== undefined && certificates !== null;
  if (!wantName && !wantId && !wantFace && !wantCerts) {
    return NextResponse.json({ error: "请至少提交一项资料（姓名/身份证/人脸/证书）" }, { status: 400 })
  }
  // 姓名与身份证成对（vendor 三要素缺一不可验）。
  if ((wantName || wantId) && !(wantName && wantId)) {
    return NextResponse.json({ error: "姓名与身份证号须成对提交" }, { status: 400 })
  }
  if (wantCerts && (!Array.isArray(certificates) || certificates.length === 0)) {
    return NextResponse.json({ error: "证书须为非空数组" }, { status: 400 })
  }

  if (wantName && wantId) {
    if (!p.phone) {
      return NextResponse.json({ error: "请先绑定手机号（三要素缺手机）" }, { status: 400 })
    }
    const v = await verifyThreeElements({
      realName: String(realName),
      idNumber: String(idNumber),
      phone: p.phone,
    })
    if (!v.ok) {
      await svc.from("profiles").update({
        verification_status: "rejected",
        verification_rejected_reason: `身份核验未通过：${v.reason ?? "信息不匹配"}（${v.provider}）`,
        verification_submitted_at: updates.verification_submitted_at,
      }).eq("id", user.id)
      return NextResponse.json({ error: `身份核验未通过：${v.reason ?? "信息不匹配"}，可核对后重提` }, { status: 400 })
    }
    const idNorm = String(idNumber).trim().toUpperCase();
    const idHash = createHash("sha256").update(idNorm).digest("hex");
    // R2 撞库：同证多号拒绝后绑（无人工列队；提示用原号）。
    const { findIdCollision } = await import("@/lib/gang-rules");
    const collision = await findIdCollision(svc, idHash, user.id);
    if (collision) {
      return NextResponse.json(
        { error: "该证件已绑定其他账号，请使用原账号登录后继续" },
        { status: 400 },
      )
    }
    updates.verification_real_name = String(realName);
    updates.verification_id_number = encryptPII(String(idNumber));
    updates.id_number_hash = idHash;
  }
  if (wantFace) {
    const v = await verifyFaceLiveness({ imageRef: String(faceImageUrl) });
    if (!v.ok) {
      await svc.from("profiles").update({
        verification_status: "rejected",
        verification_rejected_reason: `人脸核验未通过：${v.reason ?? "请正对重拍"}（${v.provider}）`,
        verification_submitted_at: updates.verification_submitted_at,
      }).eq("id", user.id)
      return NextResponse.json({ error: `人脸核验未通过：${v.reason ?? "请正对重拍"}，可重拍重提` }, { status: 400 })
    }
    updates.face_image_url = String(faceImageUrl);
    updates.face_verified_at = new Date().toISOString();
  }
  if (wantCerts) {
    updates.verification_certificates = certificates;
  }

  // 齐活即系统直批（手机戳＋身份证件＋人脸件三齐；证书为加分项不进门）。
  const phoneOk = p.phone_verified_at != null;
  const idOk = (updates.verification_id_number ?? p.verification_id_number) != null;
  const faceOk = (updates.face_verified_at ?? p.face_verified_at) != null;
  updates.verification_status = phoneOk && idOk && faceOk ? "approved" : "pending";
  if (updates.verification_status === "approved") {
    updates.verification_reviewed_by = "system";
    updates.verification_reviewed_at = new Date().toISOString();
  }

  const { error: updateError } = await svc
    .from("profiles")
    .update(updates)
    .eq("id", user.id)

  if (updateError) {
    const code = (updateError as { code?: string } | null)?.code;
    if (code === "42703") {
      return NextResponse.json(
        { error: "实名升级迁移未应用，请联系管理员执行 20260926 收编迁移" },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: updates.verification_status })
})
