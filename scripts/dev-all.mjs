/**
 * dev:all — 并行启动根项目 (3000) 与 oto-spatial-web (3001)。
 *
 * - 子项目 dev 单跑仍用自身 run-dev.mjs（端口 3000，带 watchdog）；
 *   此处直连 next bin 并错开端口，避免与本项目 e2e/生产流程的
 *   localhost:3000 假设冲突（e2e-mjs 系列硬编码 3000）。
 * - Ctrl+C 时收尾两个子进程。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const otoRoot = path.join(root, "oto-spatial-web");

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

const children = [
  start("root(next dev :3000)", root, ["dev"]),
  start("oto(next dev :3001)", otoRoot, ["dev", "-p", "3001"]),
];

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const c of children) c.kill(sig);
  });
}