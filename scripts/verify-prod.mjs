/**
 * 生产模拟验收（上线演练）— 一键跑通「上线状态」：
 *   npm run build → 生产服务 :3000 → 按序跑全部 e2e（撮合/多人拼单局/推送/治理/
 *   履约/评价/信任/离线降级/应用）→ 汇总。任一失败即退出非零。
 * 用法：node scripts/verify-prod.mjs
 * 说明：每个 e2e 脚本独立浏览器上下文（多用户/多端模拟），全部基于纯本地
 * 数据层 → 等价于「模拟上线后的完整状态」。
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suite = [
  "e2e-app.mjs",
  "e2e-acceptance.mjs",
  "e2e-match.mjs",
  "e2e-openmatch.mjs",
  "e2e-push.mjs",
  "e2e-wave.mjs",
  "e2e-trust.mjs",
  "e2e-trust-open.mjs",
  "e2e-review.mjs",
  "e2e-fulfil.mjs",
  "e2e-governance.mjs",
  "e2e-offline.mjs",
];

const run = (cmd, label) => {
  console.log(`\n=== ${label} ===`);
  execSync(cmd, { stdio: "inherit", cwd: root });
  console.log(`✓ ${label} PASS`);
};

if (process.argv.includes("--dev-server")) {
  // 跳过构建/重启，假定服务已在跑（本地迭代调试用）
  console.log("[verify-prod] using existing server on :3000");
} else {
  run("npm run build", "build (production bundle)");
  run("node scripts/restart-prod.mjs", "restart production server (next start)");
}

let failed = false;
for (const script of suite) {
  await new Promise((r) => setTimeout(r, 2500)); // P2 稳健化：脚本间冷却，规避共享服务端时序脆弱
  try {
    run(`node scripts/${script}`, script);
  } catch {
    failed = true;
    console.error(`✗ ${script} FAILED`);
  }
}

if (failed) {
  console.error(`\nverify-prod: ${suite.length} 个演练项中有未通过的模块，见上。`);
  process.exit(1);
}
console.log(`\nverify-prod: 生产模拟验收全部通过（${suite.length} 个演练项）✓`);