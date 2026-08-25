/**
 * P1-3 阶段三 · 受控隔离探针：云端 order_state_logs 成功态物理落盘验证。
 * 用法：npm run restart:prod && node scripts/probe-sos-cloud.mjs
 *
 * 安全约束（指挥官裁决 方案 A）：
 *   - 探针订单号严格前缀 TEST-PROBE-SOS-<ts>，绝不混淆业务命名空间；
 *   - 仅验证 orders(order_no) ➔ order_state_logs FK 打通后的 persisted:true；
 *   - 验证完成后由指挥官确认执行本脚本输出的精准清理 SQL（脚本自身不删除）。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

function loadEnvFile(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || key.includes("placeholder")) {
  console.error("❌ 缺少 SUPABASE_SERVICE_ROLE_KEY，无法执行受控探针");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const orderNo = `TEST-PROBE-SOS-${Date.now()}`;
const snapshot = {
  snapshotId: `sos-3-probe-${Math.random().toString(36).slice(2, 10)}`,
  userId: "u-probe",
  orderNo,
  level: 3,
  timestamp: Date.now(),
  trajectoryPayload: {
    generatedAt: Date.now(),
    pointCount: 1,
    lastPoint: { lat: 30.6581, lng: 104.0654, at: Date.now() },
    speedKmh: null,
    anomalyFlags: [],
    trail: "30.658100,104.065400",
  },
  audioEvidenceSummary: {
    chunkCount: 1,
    totalBytes: 256,
    fingerprints: ["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    integrityOk: true,
    failedChunkIds: [],
  },
};

const cleanupHint = `-- 清理 SQL（指挥官确认后执行）:\nDELETE FROM public.order_state_logs WHERE order_no LIKE 'TEST-PROBE-SOS-%';\nDELETE FROM public.orders WHERE order_no LIKE 'TEST-PROBE-SOS-%';`;

try {
  // 1. 探针订单落库（满足 order_state_logs.order_no FK）
  const ins = await supabase.from("orders").insert({
    order_no: orderNo,
    user_id: 999999,
    category_code: "TEST_PROBE",
    status: "PUBLISHED",
    total_amount: 100,
    payable_amount: 100,
    target_lng: 104.0654,
    target_lat: 30.6581,
    address_detail: "E2E-SOS-PROBE 受控探针",
    biz_params: {},
    split_plan_json: {},
  });
  assert.equal(ins.error, null, `探针订单写入失败: ${JSON.stringify(ins.error)}`);
  console.log(`✅ 探针订单已落库 order_no=${orderNo}`);

  // 2. 触发真实 SOS 路由（本地 prod server）
  const res = await fetch("http://localhost:3000/api/sos/trigger", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: "u-probe",
      waveId: orderNo,
      level: 3,
      note: "受控隔离探针：云端成功态验证",
      snapshot,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `路由响应异常 ${res.status}`);
  assert.equal(body.success, true);
  assert.equal(body.forensic.persisted, true, `persisted 应为 true，实际: ${JSON.stringify(body.forensic)}`);
  assert.match(body.forensic.authoritativeHash, /^[0-9a-f]{64}$/);
  console.log(`✅ 路由受理 persisted=true authoritativeHash=${body.forensic.authoritativeHash}`);

  // 3. 物理核对 order_state_logs 落盘行
  const sel = await supabase
    .from("order_state_logs")
    .select("*")
    .eq("order_no", orderNo)
    .eq("hook_name", "CRISIS_SOS_TRIGGERED");
  assert.equal(sel.error, null, JSON.stringify(sel.error));
  assert.equal((sel.data ?? []).length, 1, `应恰有 1 条锚点行，实际 ${(sel.data ?? []).length}`);
  const row = sel.data[0];
  assert.equal(row.idempotency_key, `sos:${snapshot.snapshotId}`);
  assert.equal(row.hook_payload.authoritativeHash, body.forensic.authoritativeHash);
  assert.equal(row.hook_payload.snapshot.snapshotId, snapshot.snapshotId);
  console.log("✅ order_state_logs 锚点行物理在案:", {
    id: row.id,
    from_to: `${row.from_state}→${row.to_state}`,
    hash_match: true,
    idempotency_key: row.idempotency_key,
  });

  console.log("\n🎯 probe-sos-cloud PASS ✓（FK 打通 + 权威哈希固化 + 审计行入库 全链实证）");
  console.log(cleanupHint);
} catch (err) {
  console.error("\n💥 probe-sos-cloud FAIL:", String(err).slice(0, 500));
  console.log(cleanupHint);
  process.exitCode = 1;
}
