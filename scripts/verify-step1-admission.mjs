// scripts/verify-step1-admission.mjs — Step1 旧宇宙清场与准入下沉物理验收
// 段1 清场文件存在性 / 段2 全仓悬空引用扫描 / 段3 useWaveStore 双 action 接线
// 段4 admission 契约增补 / 段5 测试与管线注册
// （运行时四闸行为由 src/base/risk/admission.test.ts 10 用例实证，本脚本不重复）
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let passes = 0;
let failures = 0;
const ok = (m) => { passes++; console.log(`✓ PASS: ${m}`); };
const fail = (m) => { failures++; console.error(`✗ FAIL: ${m}`); };
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ── 1. 旧宇宙物理清场：指定对象必须不存在；新宇宙产物必须存在 ──
const mustNotExist = [
  "src/app/api/telecom",
  "src/app/api/disputes/resolve",
  "src/app/api/v1",
  "src/lib/agent-gateway.ts",
  "src/lib/mockData.ts",
  "src/modules/m02-auth",
  "src/modules/m04-protocol-generation",
  "src/modules/m12-push",
  "src/modules/mM02-mM13",
];
for (const p of mustNotExist) {
  if (!exists(p)) ok(`已出清: ${p}`);
  else fail(`旧宇宙残留未清场: ${p}`);
}
for (const p of [
  "src/base/risk/admission.ts",
  "src/base/risk/admission.test.ts",
  "src/types/oto-experience.ts",
  "src/ammo/experience-catalog.ts",
]) {
  if (exists(p)) ok(`存在: ${p}`);
  else fail(`缺失: ${p}`);
}

// ── 2. 全仓悬空引用扫描（import 语句级）──
function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name)) out.push(full);
  }
  return out;
}
const allFiles = ["src", "tests", "scripts", "docs"]
  .filter((d) => exists(d))
  .flatMap((d) => walk(d))
  .filter((f) => !f.endsWith("verify-step1-admission.mjs"));
const DANGLING = [
  "@/lib/agent-gateway",
  "@/lib/mockData",
  "lib/mockData",
  "@/modules/m02-auth",
  "@/modules/m04-protocol-generation",
  "@/modules/m12-push",
  "modules/mM02-mM13",
];
let danglingHits = 0;
for (const file of allFiles) {
  const content = read(file);
  for (const needle of DANGLING) {
    const re = new RegExp(`from\\s+["'][^"']*${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    if (re.test(content)) {
      fail(`${file} 悬空引用: ${needle}`);
      danglingHits++;
    }
  }
}
if (danglingHits === 0) ok("全仓无悬空 import（agent-gateway/mockData/m02/m04/m12/mM02-mM13）");

// ── 3. useWaveStore 双 action 接线与封禁 null 契约 ──
{
  const storeSrc = read("src/store/useWaveStore.ts");
  if (storeSrc.includes("evaluatePublishAdmission")) ok("useWaveStore 已接线统一准入引擎");
  else fail("useWaveStore 未接线 evaluatePublishAdmission");
  if (!storeSrc.includes("sentinelCheck") && !storeSrc.includes("recordSentinel(")) {
    ok("store 内联甄检拼装已消除（闸门唯一出口 = admission）");
  } else {
    // recordSentinel( 可能以注释形式残留，严格判非注释行
    const live = storeSrc.split("\n").filter((l) => !l.trim().startsWith("//") && /sentinelCheck\(|recordSentinel\(/.test(l));
    if (live.length === 0) ok("store 内联甄检拼装已消除");
    else fail(`store 仍存内联甄检调用: ${live.length} 处`);
  }
  for (const action of ["createPendingWave", "publishWave"]) {
    const implIdx = storeSrc.lastIndexOf(`${action}:`);
    if (implIdx === -1) { fail(`未找到 ${action}`); continue; }
    const slice = storeSrc.slice(implIdx, implIdx + 3500);
    if (slice.includes("evaluatePublishAdmission")) ok(`${action} 调用统一引擎`);
    else fail(`${action} 未调用 evaluatePublishAdmission`);
  }
  if (/blockedReason === "banned"\)\s*return null/.test(storeSrc)) {
    ok("封禁 null 契约保持（PublishSheet「账号已被平台限制」文案路径不变）");
  } else fail("封禁 null 契约丢失");
  if (storeSrc.includes("minorBlocked")) ok("minorBlocked 新旗标已声明");
  else fail("useWaveStore 缺 minorBlocked");
}

// ── 4. UI minor 出口与 admission 契约增补 ──
for (const [p, kw] of [
  ["src/components/waves/PublishSheet.tsx", "minorBlocked"],
  ["src/components/oto-ui/chat/ChatPage.tsx", "minorBlocked"],
]) {
  if (read(p).includes(kw)) ok(`${path.basename(p)} 已补 minor 拦截文案出口`);
  else fail(`${p} 未处理 ${kw}`);
}
{
  const t = read("src/base/risk/admission.ts");
  for (const kw of ["sentinelScore", "blockedReason", "homeAccessKeywords"]) {
    if (t.includes(kw)) ok(`admission 契约含 ${kw}`);
    else fail(`admission 契约缺 ${kw}`);
  }
  if (!/from\s+["'].*(@\/store|@\/ammo|\.\.\/\.\.\/store)/.test(t)) {
    ok("admission 零 store/ammo 反向依赖（红线 3）");
  } else fail("admission 违反红线 3：反向依赖 store/ammo");
}

// ── 5. 测试与管线注册 ──
{
  const pkg = JSON.parse(read("package.json"));
  if ((pkg.scripts["test:oto:units"] ?? "").includes("admission.test.ts")) {
    ok("test:oto:units 已注册 admission.test.ts");
  } else fail("package.json 未注册 admission.test.ts");
  const at = read("src/base/risk/admission.test.ts");
  const cases = (at.match(/\bit\(/g) ?? []).length;
  if (cases >= 10) ok(`admission 单测 ${cases} 用例`);
  else fail(`admission 用例不足 10（实为 ${cases}）`);
}

console.log(`\n—— Step1 验证汇总: ${passes} passed, ${failures} failed ——`);
if (failures > 0) { console.error("Step1 清场与准入下沉验证未通过"); process.exit(1); }
console.log("Step1 物理验收全部通过：清场零悬空 · 四闸唯一出口 · 封禁 null 契约保持 · 红线 3 合规");
