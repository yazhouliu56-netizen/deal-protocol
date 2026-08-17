/**
 * 解析钩子实现（被 node-ts-loader.mjs register 加载）。
 * 见 node-ts-loader.mjs 的说明。
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { isAbsolute } from "node:path";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const ALIAS_MAP = new Map([
  ["@/", "src/"],
  ["@base/", "src/base/"],
  ["@ammo/", "src/ammo/"],
]);

const toFileUrl = (target) =>
  isAbsolute(target) ? pathToFileURL(target).href : target;

export async function resolve(specifier, context, nextResolve) {
  // 1) 相对路径缺扩展名 → 尝试追加 .ts（TS 源码无扩展名惯例）
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[cm]?[jt]s$/.test(specifier)
  ) {
    try {
      return await nextResolve(specifier + ".ts", context);
    } catch {
      // 落回默认解析（目录 / JSON 等场景）
    }
  }
  // 2) 别名 → src 映射（映射目标统一转 file:// URL 供默认 loader 消费）
  for (const [prefix, mapped] of ALIAS_MAP) {
    if (!specifier.startsWith(prefix)) continue;
    const target = ROOT + mapped + specifier.slice(prefix.length);
    try {
      return await nextResolve(toFileUrl(target), context);
    } catch {
      try {
        return await nextResolve(toFileUrl(target + ".ts"), context);
      } catch {
        // 落回默认
      }
    }
  }
  return nextResolve(specifier, context);
}