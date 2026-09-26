/** C 全功能 M4：分阶段放款 HTTP 全链路（seed→交验→放款→对账→幂等→清理）。
 *
 * 无 supabase env / 服务端不可达 → SKIP exit 0（M7 有 env 跑真链路）。
 * 有 env → 真链路：建双用户＋合同＋2 阶段行，经 M1 API 交验放款，
 * 断言钱包到账＋MILESTONE_PAYOUT 落账＋重放幂等＋局外人 403，最后清场。
 */
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getE2eBaseUrl } from "./lib/e2e-channel.mjs";

// 脚本进程无 dotenv：就近读 .env.local（verify-prod/裸跑同口径，不覆盖既有 env）。
{
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  for (const f of [".env.local", ".env"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      if (k && !(k in process.env)) process.env[k] = t.slice(i + 1).trim();
    }
  }
}

const BASE = getE2eBaseUrl();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function skip(msg) {
  console.log(`e2e-milestone SKIP（${msg}）`);
  process.exit(0);
}

if (!SUPABASE_URL || !ANON || !SERVICE || ANON.length < 30 || SERVICE.length < 100) {
  skip("supabase env 缺席");
}

let serverUp = false;
try {
  const h = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(15000) });
  serverUp = h.ok;
} catch {
  serverUp = false;
}
if (!serverUp) skip("服务端不可达");

const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
if (!ref || !new URL(SUPABASE_URL).hostname.endsWith(".supabase.co")) skip("非标准 supabase 域，cookie 编解码未知");

const svc = createClient(SUPABASE_URL, SERVICE);

// 收编门：如果云端缺列（收编迁移未应用），SKIP 并点名缺列——
// 强行跑只会得到 42703 误报 FAIL，掩盖真问题。
{
  const needCols = [
    ["contracts", "dispute_status"],
    ["milestone_schedules", "submitted_at"],
    ["disputes", "responder_evidence"],
  ];
  const missing = [];
  for (const [table, col] of needCols) {
    const { error } = await svc.from(table).select(col).limit(1);
    if (error) missing.push(`${table}.${col}`);
  }
  if (missing.length > 0) {
    skip(`云端缺列（待收编迁移应用后重跑）: ${missing.join(", ")}`);
  }
}
const tag = `e2ems${Date.now().toString(36)}`;
const password = `Pw-${tag}-9x!`;
const mkUser = async (role) => {
  const { data, error } = await svc.auth.admin.createUser({
    email: `${tag}-${role}@t.e2e`,
    password,
    email_confirm: true,
  });
  assert.ok(!error && data.user, `建用户失败: ${error?.message}`);
  return data.user.id;
};
const toCookie = (session) =>
  `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;

let customerId = "";
let providerId = "";
let contractId = "";
const rowIds = [];
try {
  customerId = await mkUser("c");
  providerId = await mkUser("p");
  contractId = randomUUID();
  // demands 行：wallet_logs.order_id FK 指向 demands（012 原始定义），
  // 且 contracts.demand_id 关联需求——照生产 demands 流口径建种。
  {
    const { error } = await svc.from("demands").insert({
      id: contractId,
      demander_id: customerId,
      title: `e2e-ms-${tag}`,
      status: "MATCHED",
    });
    assert.ok(!error, `建 demands 失败: ${error?.message}`);
  }
  // profiles 行：外键底座（provider_wallets.provider_id→profiles），照 register 口径。
  for (const [id, role] of [[customerId, "demander"], [providerId, "provider"]]) {
    const { error } = await svc.from("profiles").insert({
      id,
      name: `e2e-ms-${tag}`,
      phone: null,
      role,
    });
    assert.ok(!error, `建 profiles 失败: ${error?.message}`);
  }
  const anon = createClient(SUPABASE_URL, ANON);
  const signCookie = async (id) => {
    const email = id === customerId ? `${tag}-c@t.e2e` : `${tag}-p@t.e2e`;
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    assert.ok(!error && data.session, `登录失败: ${error?.message}`);
    return toCookie(data.session);
  };
  const customerCookie = await signCookie(customerId);
  const providerCookie = await signCookie(providerId);
  const api = async (path, { method = "GET", cookie, body } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* 非 JSON 照原文抛错 */
    }
    return { status: res.status, json, text };
  };

  // 会话自检：坏合同 id 应 404 而非 401（401＝cookie 编解码失效，直接 FAIL）。
  const probe = await api(`/api/milestones?contractId=no-such`, { cookie: customerCookie });
  assert.notEqual(probe.status, 401, "会话 cookie 被拒（编解码失效）");

  // seed：合同＋2 阶段行（PENDING 起，练 PENDING→SUBMITTED 路）。
  const { error: cErr } = await svc.from("contracts").insert({
    id: contractId,
    customer_id: customerId,
    provider_id: providerId,
    demand_id: contractId,
    fund_status: "HELD",
    amount: 800,
  });
  assert.ok(!cErr, `建合同失败: ${cErr?.message}`);
  for (const [i, title] of ["拆旧清运", "水电改造"].entries()) {
    const { data, error } = await svc
      .from("milestone_schedules")
      .insert({
        contract_id: contractId,
        title,
        amount: 400,
        step_number: i + 1,
        status: "PENDING",
      })
      .select("id")
      .single();
    assert.ok(!error && data, `建行失败: ${error?.message}`);
    rowIds.push(data.id);
  }

  // 未登录 → 401。
  const anonProbe = await api(`/api/milestones?contractId=${contractId}`, {
    cookie: "sb-x=0",
  });
  assert.equal(anonProbe.status, 401, "未登录应 401");

  // 服务方交验第 1 期。
  const sub = await api(`/api/milestones/${rowIds[0]}/submit`, {
    method: "POST",
    cookie: providerCookie,
  });
  assert.equal(sub.status, 200, `交验失败: ${sub.text}`);
  assert.equal(sub.json.submitted, true);

  // 需求方放款第 1 期（400；佣金 0＋通道缺席＝实得 400）。
  const rel = await api(`/api/milestones/${rowIds[0]}/release`, {
    method: "POST",
    cookie: customerCookie,
  });
  assert.equal(rel.status, 200, `放款失败: ${rel.text}`);
  assert.equal(rel.json.released, true);
  assert.equal(rel.json.amountYuan, 400);

  // 对账：钱包到账＋MILESTONE_PAYOUT 落账。
  const { data: wallet } = await svc
    .from("provider_wallets")
    .select("balance")
    .eq("provider_id", providerId)
    .single();
  assert.ok(Number(wallet?.balance) >= 400, `钱包未到账: ${wallet?.balance}`);
  const { data: logs } = await svc
    .from("wallet_logs")
    .select("id")
    .eq("order_id", contractId)
    .eq("type", "milestone_payout")
    .limit(5);
  assert.ok((logs ?? []).length >= 1, "MILESTONE_PAYOUT 未落账");

  // 重放幂等。
  const rel2 = await api(`/api/milestones/${rowIds[0]}/release`, {
    method: "POST",
    cookie: customerCookie,
  });
  assert.equal(rel2.status, 200);
  assert.equal(rel2.json.alreadyReleased, true);

  // 越权：服务方放款 → 403。
  const fob = await api(`/api/milestones/${rowIds[1]}/release`, {
    method: "POST",
    cookie: providerCookie,
  });
  assert.equal(fob.status, 403, "服务方放款应 403");

  console.log("e2e-milestone PASS（交验→放款→对账→幂等→越权全链路）");
} finally {
  // 清场（best-effort，不污染云端；builder 仅 thenable，逐项 try/catch）。
  const quiet = async (p) => {
    try {
      await p;
    } catch {
      /* 清场失败只告警，不污染 verdict */
    }
  };
  try {
    if (rowIds.length > 0) await svc.from("milestone_schedules").delete().in("id", rowIds);
    if (contractId) {
      await svc.from("wallet_logs").delete().eq("order_id", contractId);
      await svc.from("contracts").delete().eq("id", contractId);
      await quiet(svc.from("demands").delete().eq("id", contractId));
    }
    let w = null;
    try {
      const r = await svc.from("provider_wallets").select("provider_id").eq("provider_id", providerId).single();
      w = r.data;
    } catch {
      w = null;
    }
    if (w) await svc.from("provider_wallets").delete().eq("provider_id", providerId);
    if (customerId) await quiet(svc.from("profiles").delete().eq("id", customerId));
    if (providerId) await quiet(svc.from("profiles").delete().eq("id", providerId));
    if (customerId) await quiet(svc.auth.admin.deleteUser(customerId));
    if (providerId) await quiet(svc.auth.admin.deleteUser(providerId));
  } catch (e) {
    console.log(`e2e-milestone 清场警告: ${e instanceof Error ? e.message : e}`);
  }
}
