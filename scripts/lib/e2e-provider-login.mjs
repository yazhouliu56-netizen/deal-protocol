/**
 * E2E provider 会话预置（Phase 2.2-C 动作门禁配套）。
 * 工作台写动作仅真实 provider 会话放行，e2e-app 需先建号登录。
 * 账号幂等（重复运行复用），调用方在成功/失败路径按需清理。
 */
import { createClient } from "@supabase/supabase-js";

export const E2E_PROVIDER_EMAIL = "e2e.provider@e2e.local";
const E2E_PROVIDER_NAME = "E2EPro";
const E2E_PROVIDER_PHONE = "13900009999";
// 占位口令：仅本地 e2e 有效，提交前按仓库密钥纪律复核。
const E2E_PROVIDER_PW = "e2e-local-only-0000";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

export async function ensureE2EProviderSession(page, base) {
  await page.request.post(`${base}/api/register`, {
    data: {
      name: E2E_PROVIDER_NAME,
      email: E2E_PROVIDER_EMAIL,
      password: E2E_PROVIDER_PW,
      phone: E2E_PROVIDER_PHONE,
      role: "provider",
    },
  });

  const svc = serviceClient();
  const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const hit = (data?.users || []).find((u) => u.email === E2E_PROVIDER_EMAIL);
  if (!hit) throw new Error("e2e provider register failed");
  await svc.auth.admin.updateUserById(hit.id, { email_confirm: true });

  await page.goto(`${base}/dp/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: /账号密码/ }).click();
  await page.getByLabel("邮箱").fill(E2E_PROVIDER_EMAIL);
  await page.getByLabel("密码").fill(E2E_PROVIDER_PW);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL(/dp\/provider\/incoming/, { timeout: 20000 });
  return hit.id;
}

export async function cleanupE2EProvider(userId) {
  if (!userId) return;
  const svc = serviceClient();
  for (const table of ["users", "profiles"]) {
    await svc.from(table).delete().eq("id", userId);
  }
  await svc.auth.admin.deleteUser(userId);
}
