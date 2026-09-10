/**
 * 终结本仓残留 prod 服务（P15 hygiene：.next 锁盘三连的根治）。
 * 只认 .opencode/prod-pid.txt 追踪到的自有子进程（restart-prod.mjs 写入），
 * 动手前按身份复核（cmdline 必须同时含本仓路径与 standalone/start-server），
 * 绝不按端口滥杀。hygiene 永不阻断调用方：任何异常都 exit 0。
 * 用法：node scripts/stop-stale-prod.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pidFile = path.join(root, ".opencode", "prod-pid.txt");
const SELF = process.pid;

function cmdlineOf(pid) {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId=${pid}\\").CommandLine"`,
        { encoding: "utf8", timeout: 15000 },
      );
      return out || "";
    }
    return execSync(`ps -p ${pid} -o args=`, { encoding: "utf8", timeout: 15000 }) || "";
  } catch {
    return "";
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killTree(pid) {
  if (process.platform === "win32") {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch { /* already gone */ }
  }
}

function norm(p) {
  return p.replace(/\\/g, "/").toLowerCase();
}

const EXIT_OK = 0;
try {
  if (!existsSync(pidFile)) {
    console.log("[stop-stale-prod] no tracked server (no pidfile).");
  } else {
    const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      console.log("[stop-stale-prod] pidfile corrupt, clearing.");
      rmSync(pidFile, { force: true });
    } else if (pid === SELF) {
      console.log("[stop-stale-prod] pidfile points at self, clearing without kill.");
      rmSync(pidFile, { force: true });
    } else if (!alive(pid)) {
      console.log(`[stop-stale-prod] pid ${pid} already dead, clearing pidfile.`);
      rmSync(pidFile, { force: true });
    } else {
      const cmd = cmdlineOf(pid);
      const tagged = norm(cmd).includes(norm(root)) &&
        (cmd.includes("standalone") || cmd.includes("start-server"));
      if (!tagged) {
        console.log(`[stop-stale-prod] pid ${pid} identity mismatch (not ours), keeping pidfile.`);
      } else {
        try {
          killTree(pid);
          console.log(`[stop-stale-prod] killed stale prod server (pid ${pid}).`);
        } catch (e) {
          console.log(`[stop-stale-prod] kill failed for pid ${pid}: ${e instanceof Error ? e.message : e}`);
        }
        rmSync(pidFile, { force: true });
      }
    }
  }
} catch (e) {
  console.log(`[stop-stale-prod] hygiene skipped: ${e instanceof Error ? e.message : e}`);
}
process.exit(EXIT_OK);
