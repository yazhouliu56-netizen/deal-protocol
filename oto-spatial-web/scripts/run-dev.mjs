/**
 * Dev server launcher with a watchdog for non-interactive shells.
 *
 * `next dev` is a long-running process. When launched from an automation
 * shell (opencode / pipes / CI) it never exits, which reads as a "hang".
 * This wrapper:
 *   - interactive terminal (isTTY)  -> run next dev normally, stay resident
 *   - non-interactive shell         -> start next dev with a watchdog timeout
 *     (default 180s, override with DEV_GUARD_TIMEOUT_MS, 0 = disable),
 *     kill the server when it fires and print a clear exit message.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const interactive = Boolean(process.stdin.isTTY);

function startDev() {
  return spawn(process.execPath, [nextBin, "dev"], {
    cwd: root,
    stdio: "inherit",
    windowsHide: false,
  });
}

if (interactive) {
  // Human in a real terminal: dev server stays up as expected.
  const child = startDev();
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  const raw = Number(process.env.DEV_GUARD_TIMEOUT_MS ?? 180000);
  const timeoutMs = Number.isFinite(raw) && raw >= 0 ? raw : 180000;
  if (timeoutMs > 0) {
    console.log(
      `[dev-guard] non-TTY run detected: starting next dev with a ${Math.round(timeoutMs / 1000)}s watchdog.`
    );
    console.log(
      "[dev-guard] next dev is a long-running server; it will be killed when the watchdog fires."
    );
    console.log("[dev-guard] override with DEV_GUARD_TIMEOUT_MS (0 = run without watchdog).");
  }
  const child = startDev();
  const timer = timeoutMs > 0
    ? setTimeout(() => {
        console.log(
          `[dev-guard] watchdog fired after ${Math.round(timeoutMs / 1000)}s — killing next dev to avoid a hung session.`
        );
        child.kill();
        process.exit(0);
      }, timeoutMs)
    : null;
  child.on("exit", (code) => {
    if (timer) clearTimeout(timer);
    process.exit(code ?? 0);
  });
}
