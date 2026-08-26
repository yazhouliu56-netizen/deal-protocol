/**
 * P2-7 测试跑道自动发现运行器（Microkernel 2.0 战役 5 · 白名单地雷终结）。
 *
 * 职责：Glob 动态扫描 node:test 域三大纯逻辑目录（src/base、src/adapters、
 * src/ammo）下全部 *.test.ts，交 Node 原生 --test 执行——彻底出清
 * package.json 中 102 处手写测试文件白名单，新建考卷零注册即执行。
 *
 * 单一事实源镜像：vitest.config.ts 的 exclude 将上述三域整体排除（jsdom/
 * 组件域归 vitest，纯逻辑域归本跑道），两侧互补且零重叠。新增测试文件
 * 只需落盘于对应域目录，即被对应跑道自动发现。
 *
 * 等价守恒：执行器参数与原 package.json test:oto:units 逐字一致
 * （--experimental-transform-types + node-ts-loader.mjs 别名/扩展名钩子）。
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SCAN_DIRS = ["src/base", "src/adapters", "src/ammo"];

/** 递归收集目录树内全部 *.test.ts（node:test 域仅收 .ts；.tsx 归 vitest）。 */
function collectTestFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      collectTestFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => collectTestFiles(join(ROOT, d)))
  .map((f) => relative(ROOT, f).split(sep).join("/"))
  .sort();

if (files.length === 0) {
  console.error("[run-oto-units] 未发现任何 *.test.ts —— 扫描域异常，终止。");
  process.exit(1);
}

console.log(`[run-oto-units] 自动发现 ${files.length} 份 node:test 考卷（base/adapters/ammo 三域 Glob 扫描）。`);

// 执行器链路与原白名单时代逐字一致：TS 类型剥离 + @/ 别名钩子 + 原生 --test。
const res = spawnSync(
  process.execPath,
  [
    "--experimental-transform-types",
    "--import",
    "./scripts/node-ts-loader.mjs",
    "--test",
    ...files,
  ],
  { cwd: ROOT, stdio: "inherit" },
);

process.exit(res.status ?? 1);
