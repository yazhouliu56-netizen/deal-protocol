/**
 * dev:all — 启动单体应用 (dev :3000)。
 *
 * - 单仓融合（ADR-0018 Phase 6）后 oto-spatial-web 已废弃，
 *   唯一开发入口为根 next dev（:3000），e2e-mjs 系列硬编码 3000 不变。
 * - Ctrl+C 时收尾子进程。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const children = [start("next dev :3000", root, ["dev"])];

function start(label, cwd, args) {
  const child = spawn(process.execPath, [nextBin, ...args], {
    cwd,
    stdio: "inherit",
    windowsHide: false,
  });
  child.on("exit", (code) => {
    console.log(`[dev:all] ${label} exited (${code ?? "signal"})`);
    process.exit(code ?? 0);
  });
  return child;
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const c of children) c.kill(sig);
  });
}