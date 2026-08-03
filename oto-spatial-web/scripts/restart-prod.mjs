/**
 * 一键重启生产服务（kill 3000 占用 + 启动 next start + 轮询 200）。
 * 用法：node scripts/restart-prod.mjs
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

// 3. start fresh
const child = spawn("cmd.exe", ["/c", "npm run start > prod-server.log 2> prod-server-err.log"], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();
writeFileSync(pidFile, String(child.pid));
console.log(`[restart] started (wrapper pid ${child.pid})`);

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
