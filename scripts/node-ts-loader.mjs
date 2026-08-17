/**
 * node:test 白名单运行器的最小化 TS 解析钩子（阶段 1 考卷使能，注册即用）。
 *
 * 背景：src/base/ai/chat/mockEngine.ts 走无扩展名相对导入（"./types"、
 * "./slots"）与 @/ 别名（"@/base/dispatch/match"），Node 原生
 * --experimental-transform-types 不解析这两类说明符。
 *
 * 本钩子仅做两件事（其余 1392 基线测试零影响，解析失败的路径原本就失败）：
 *   1. 相对路径缺扩展名 → 尝试追加 .ts；
 *   2. "@/…" / "@base/…" / "@/base/…" / "@/ammo/…" 别名 → 映射到 ./src/…。
 *
 * 用法：node --experimental-transform-types --import ./scripts/node-ts-loader.mjs --test <files>
 */
import { register } from "node:module";

register(new URL("./node-ts-hooks.mjs", import.meta.url));