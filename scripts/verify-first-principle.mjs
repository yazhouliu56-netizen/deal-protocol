/**
 * Microkernel 4.1 批次 1 · 第一性原理物理门禁
 * 断言：HOT_HINTS 硬编码归零 + Base 纯核 0 Store 引用
 */
import { execSync } from "node:child_process";

function countGrep(pattern, path) {
  try {
    const out = execSync(`git grep -E "${pattern}" -- ${path}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const lines = out.trim().split("\n").filter(Boolean);
    // 过滤 verify 脚本自身对模式的自引用（若脚本内含 pattern 字符串）
    const filtered = lines.filter((l) => !l.includes("verify-first-principle.mjs"));
    return filtered.length;
  } catch {
    // git grep exit 1 = 0 hits
    return 0;
  }
}

function check(pattern, path, expect, label) {
  const count = countGrep(pattern, path);
  const pass = count === expect;
  console.log(`${pass ? "✓" : "✗"} ${label}: ${pattern} in ${path} → ${count} (expect ${expect}) ${pass ? "PASS" : "FAIL"}`);
  if (!pass) {
    try {
      const out = execSync(`git grep -n -E "${pattern}" -- ${path}`, { encoding: "utf8" });
      console.log(out);
    } catch {}
  }
  return pass;
}

let ok = true;
ok = check("HOT_HINTS", "src", 0, "HOT_HINTS 硬编码归零") && ok;
ok = check("import.*useIdentityStore", "src/base", 0, "Base 纯核 0 Store 引用") && ok;

if (ok) {
  console.log("ALL PASS: first-principle gate (HOT_HINTS 0, base->store 0)");
  process.exit(0);
} else {
  console.error("FAIL: first-principle gate");
  process.exit(1);
}
