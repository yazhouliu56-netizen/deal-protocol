/**
 * 一键重启生产服务（kill 3000 占用 + 启动 next start + 轮询 200）。
 * 用法：node scripts/restart-prod.mjs
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pidFile = path.join(root, ".opencode", "prod-pid.txt");

function kill(desc, pid) {
  if (!pid) return;
  try {
    // Windows: /T kills the whole tree (cmd wrapper -> node child)
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    console.log(`[restart] killed ${desc} (pid ${pid})`);
  } catch {
    /* already gone */
  }
}

// 1. kill tracked cmd wrapper
if (existsSync(pidFile)) {
  const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
  kill("cmd wrapper", pid);
}

// 2. free port 3000
try {
  const out = execSync(
    `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess"`,
    { encoding: "utf8" }
  ).trim();
  if (out) kill("port-3000 owner", parseInt(out, 10));
} catch {
  /* no listener */
}

await new Promise((r) => setTimeout(r, 1500));

// 3. start fresh — 直接 spawn node + next CLI，不经 cmd.exe：
//    cmd /c npm run start 在 detached/无控制台场景会弹出「终止批处理操作吗(Y/N)?」
//    并永久挂起等待 stdin（stdio ignore 后无人应答）→ 每次 restart 都有概率假死，
//    且下游 E2E/build 撞上死掉的 3000 端口表现为「卡住」。node 直启无此问题。
const out = openSync(path.join(root, "prod-server.log"), "a");
const err = openSync(path.join(root, "prod-server-err.log"), "a");
const child = spawn(
  process.execPath,
  [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", "3000"],
  {
    cwd: root,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true,
  }
);
child.unref();
writeFileSync(pidFile, String(child.pid));
console.log(`[restart] started (pid ${child.pid})`);

// 4. poll until 200
let ready = false;
for (let i = 0; i < 30 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    const res = await fetch("http://localhost:3000");
    if (res.ok) ready = true;
  } catch {
    /* not up yet */
  }
}
if (ready) {
  console.log("[restart] SERVER READY ✓");
} else {
  console.error("[restart] NOT READY after 30s — check prod-server-err.log");
  process.exitCode = 1;
}
