// scripts/verify-step0-hygiene.mjs — Step 0 卫生扫除验证脚本
// 验证项：① mockData 解耦平移 ② 3 处 import 重写等价性 ③ 死组件删除无残留 ④ no-console 门禁
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
let failures = 0;
let passes = 0;

function ok(msg) { passes++; console.log(`✓ PASS: ${msg}`); }
function fail(msg) { failures++; console.error(`✗ FAIL: ${msg}`); }
function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }

// ── 1. 数据分层文件存在性与红线检查 ──
{
  const typesPath = "src/types/oto-experience.ts";
  const ammoPath = "src/ammo/experience-catalog.ts";

  if (!exists(typesPath)) fail(`${typesPath} 不存在`);
  else {
    const c = read(typesPath);
    const hasCategory = /export\s+(type|interface)\s+OTOCategory/.test(c);
    const hasExperience = /export\s+(type|interface)\s+OTOExperience/.test(c);
    const hasRuntimeData = /otoExperiences\s*[:=]/.test(c) || /export\s+const\s+otoExperiences/.test(c);
    if (hasCategory && hasExperience) ok("types/oto-experience.ts 导出 OTOCategory + OTOExperience 类型契约");
    else fail("types/oto-experience.ts 缺少类型导出");
    if (!hasRuntimeData) ok("types 层零运行时数据（红线 3）");
    else fail("types 层不应包含 otoExperiences 运行时数据");
    if (/from\s+["']@\/types\/oto-experience["']/.test(c) || !/from\s+["']@\/lib\/mockData["']/.test(c)) {
      ok("types 层无 mockData 反向依赖");
    } else fail("types 层不应依赖 mockData");
  }

  if (!exists(ammoPath)) fail(`${ammoPath} 不存在`);
  else {
    const c = read(ammoPath);
    if (/export\s+const\s+otoExperiences/.test(c)) ok("ammo/experience-catalog.ts 导出 otoExperiences 数据表");
    else fail("ammo/experience-catalog.ts 缺少 otoExperiences 导出");
    if (/from\s+["']@\/types\/oto-experience["']/.test(c)) ok("ammo 层 import type 自 @/types/oto-experience");
    else fail("ammo 层应 import type 自 @/types/oto-experience");
    if (!/from\s+["']@\/lib\/mockData["']/.test(c)) ok("ammo 层无 mockData 依赖残留");
    else fail("ammo 层不应再依赖 @/lib/mockData");
  }
}

// ── 2. 三处 import 重写校验 ──
{
  const checks = [
    {
      file: "src/app/(oto)/page.tsx",
      expect: /from\s+["']@\/ammo\/experience-catalog["']/,
      forbid: /from\s+["']@\/lib\/mockData["'].*otoExperiences/,
      label: "(oto)/page.tsx → @/ammo/experience-catalog",
    },
    {
      file: "src/components/oto-ui/3d/SceneTemplate.tsx",
      expect: /from\s+["']@\/types\/oto-experience["']/,
      forbid: /from\s+["']@\/lib\/mockData["'].*OTOExperience/,
      label: "SceneTemplate.tsx → @/types/oto-experience",
    },
    {
      file: "src/store/useAppStore.ts",
      expectCatalog: /from\s+["']@\/ammo\/experience-catalog["']/,
      expectTypes: /from\s+["']@\/types\/oto-experience["']/,
      forbid: /from\s+["']@\/lib\/mockData["']/,
      label: "useAppStore.ts 拆分为 catalog + types 双 import",
    },
  ];

  for (const chk of checks) {
    if (!exists(chk.file)) { fail(`${chk.file} 不存在`); continue; }
    const c = read(chk.file);
    if (chk.expect && chk.expect.test(c)) ok(chk.label + " — 正向路径存在");
    else if (chk.expectCatalog && chk.expectTypes) {
      if (chk.expectCatalog.test(c) && chk.expectTypes.test(c)) ok(chk.label + " — 双 import 均存在");
      else fail(`${chk.file} 双 import 缺失 (catalog:${chk.expectCatalog.test(c)} types:${chk.expectTypes.test(c)})`);
    } else if (chk.expect) fail(`${chk.file} 未找到期望 import: ${chk.expect}`);
    if (chk.forbid && chk.forbid.test(c)) fail(`${chk.file} 仍存在对 @/lib/mockData 的旧依赖`);
    else ok(`${chk.file} 无旧 mockData 残留`);
  }

  // 零逻辑改动粗验：3 文件除 import 行外不应包含 otoExperiences 重定义
  for (const f of ["src/app/(oto)/page.tsx", "src/store/useAppStore.ts"]) {
    if (!exists(f)) continue;
    const c = read(f);
    const redefines = (c.match(/const\s+otoExperiences\s*=/g) || []).length;
    if (redefines === 0) ok(`${f} 未重定义 otoExperiences（仅 import 消费）`);
    else fail(`${f} 存在 otoExperiences 重定义，疑似逻辑改动`);
  }
}

// ── 3. 死组件删除无残留引用 ──
{
  const deadFiles = [
    "src/components/oto-ui/destinations/DestinationHub.tsx",
    "src/components/oto-ui/destinations/DestinationCard.tsx",
  ];
  for (const f of deadFiles) {
    if (!exists(f)) ok(`已删除: ${f}`);
    else fail(`死组件仍存在: ${f}`);
  }

  // 全仓 grep 残留引用
  const patterns = ["DestinationHub", "DestinationCard"];
  const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const skipDirs = new Set(["node_modules", ".git", ".next", "dist", "out", "coverage"]);

  function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (exts.includes(path.extname(entry.name))) out.push(full);
    }
    return out;
  }

  const allFiles = walk(ROOT).filter((f) => !f.endsWith("verify-step0-hygiene.mjs"));
  for (const pat of patterns) {
    const hits = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes(pat)) hits.push(path.relative(ROOT, file));
    }
    if (hits.length === 0) ok(`全仓无残留引用: ${pat}`);
    else fail(`残留引用 ${pat} 命中: ${hits.join(", ")}`);
  }
}

// ── 4. no-console 门禁配置正确性 ──
{
  if (!exists("eslint.config.mjs")) fail("eslint.config.mjs 不存在");
  else {
    const c = read("eslint.config.mjs");
    if (/"no-console"\s*:\s*\["error"/.test(c) && /"?allow"?\s*:\s*\[[^\]]*"warn"[^\]]*"error"/s.test(c)) {
      ok('eslint.config.mjs 已启用 "no-console": ["error", { allow: ["warn","error"] }]');
    } else fail('eslint.config.mjs 未正确配置 no-console 规则');

    // 豁免面校验：scripts/**、e2e/**、**/*.test.*、**/*.spec.*、src/lib/**、src/modules/**、SplitDemandView
    const expectedIgnores = ["scripts/**", "e2e/**", "*.test.", "*.spec.", "src/lib/**", "src/modules/**", "SplitDemandView"];
    const missing = expectedIgnores.filter((k) => !c.includes(k));
    if (missing.length === 0) ok("no-console 豁免面完整（scripts/e2e/test/spec/lib/modules/SplitDemandView）");
    else fail(`no-console 豁免面缺失: ${missing.join(", ")}`);
  }

  // 存活区 console.log 零残留（豁免区除外）
  const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const skipDirs = new Set(["node_modules", ".git", ".next", "dist", "out", "coverage"]);
  function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (exts.includes(path.extname(entry.name))) out.push(full);
    }
    return out;
  }
  function isExempt(relPath) {
    return (
      relPath.startsWith("scripts/") ||
      relPath.startsWith("e2e/") ||
      relPath.includes(".test.") ||
      relPath.includes(".spec.") ||
      relPath.startsWith("src/lib/") ||
      relPath.startsWith("src/modules/") ||
      relPath.includes("SplitDemandView.tsx")
    );
  }
  const srcFiles = walk(path.join(ROOT, "src"));
  const violations = [];
  for (const abs of srcFiles) {
    const rel = path.relative(ROOT, abs).replaceAll(path.sep, "/");
    if (isExempt(rel)) continue;
    const content = fs.readFileSync(abs, "utf8");
    // 匹配 console.log / console.info / console.debug（warn/error 允许）
    if (/\bconsole\.(log|info|debug)\s*\(/.test(content)) violations.push(rel);
  }
  if (violations.length === 0) ok("存活区无 console.log/info/debug 残留");
  else fail(`存活区 console 违规: ${violations.join(", ")}`);

  // 专项：sms/send route 已清理手机号明文日志
  const smsRoute = "src/app/api/auth/sms/send/route.ts";
  if (exists(smsRoute)) {
    const c = read(smsRoute);
    if (!/\bconsole\.log\b/.test(c)) ok("api/auth/sms/send/route.ts 已移除 console.log（宪法 #8）");
    else fail("api/auth/sms/send/route.ts 仍存在 console.log");
  }
}

// ── 汇总 ──
console.log(`\n—— Step 0 验证汇总: ${passes} passed, ${failures} failed ——`);
if (failures > 0) {
  console.error("Step 0 卫生扫除验证未通过");
  process.exit(1);
} else {
  console.log("Step 0 卫生扫除验证全部通过");
}
