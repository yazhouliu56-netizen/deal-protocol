/**
 * E2E 广播命名空间隔离助手（2026-08-22 战役 · 跨脚本云端共享行污染根治）。
 *
 * 物理模型：p2p_broadcast 表 anon RLS 无 DELETE 策略（零 DDL 约束）→
 * 固定 per-script 命名空间 `oto::e2e::<script>`（行数有界 ≤ 套件数），
 * 脚本启动时对自身专属行做「空 state Upsert 覆盖」自清零。
 *
 * 注入载体：context 级 addInitScript（每个 document 先于应用代码执行），
 * 传输层经 window.__OTO_CHANNEL_NS__ 安全探针锁定专属行/本地键；
 * 无云凭据时自动降级为纯本地隔离（键名派生），行为一致。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function getE2eBaseUrl() {
  return process.env.BASE_URL || "http://localhost:3000";
}

export function getDefaultLaunchOptions(overrides = {}) {
  const defaultArgs = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];
  const base = { headless: true, args: [...defaultArgs] };
  if (process.env.PLAYWRIGHT_CHANNEL !== "chromium") base.channel = "chrome";
  const merged = { ...base, ...overrides };
  if (overrides.args) {
    const seen = new Set();
    merged.args = [...base.args, ...overrides.args].filter((a) => {
      if (seen.has(a)) return false;
      seen.add(a);
      return true;
    });
  }
  return merged;
}

/** WaveBundle 规范空态（对齐 src/types/wave-bundle.ts 全字段）。 */
export const EMPTY_BUNDLE = {
  waves: [],
  claims: [],
  payOrders: [],
  responders: [],
  reviews: [],
  pushes: [],
  reports: [],
  bans: {},
  favorites: [],
  initiatorBuffs: {},
  disputes: [],
  friendRequests: [],
  friendships: [],
  friendRequestRemovals: [],
  sentinelEvents: [],
  privacySessions: [],
  imThreads: [],
  imMessages: [],
  crisisRecords: [],
  forgetRequests: [],
  circuitBreaker: { state: "closed", failures: 0, probes: 0, openedAt: 0 },
  offlineQueue: [],
  lake: [],
  signedDocs: [],
  policies: [],
};

/** 脚本专属命名空间（传输层 sanitize 白名单字符：字母数字冒号下划线连字符）。 */
export function e2eChannelNs(scriptName) {
  return `oto::e2e::${scriptName}`;
}

/** 云表探测结果（resetE2eChannelRow 调用后更新；决定是否注入 FORCE_LOCAL 探针）。 */
let cloudChannelUsable = false;

/**
 * 浏览器级隔离包装：劫持 browser.newContext，让此后创建的每个 context
 * （及其全部 page / 导航 / 刷新）都先于应用代码注入命名空间探针。
 * opts.sandboxBotOff: 额外关闭沙盒 Bot 自动接单（精确断言席位/claim 状态的脚本必需，
 * 否则 Bot 会在断言窗口内把磋商 claim 自动推进为 accepted——P0 空转治理特性）。
 *
 * 云表不可用（PGRST205 / 无凭据）时自动追加 __OTO_P2P_FORCE_LOCAL__ 探针：
 * 传输层第一帧即锁定本地通道，消除 boot-pull 悬挂窗口内的首写悬空延迟。
 * 注意调用顺序：须先 await resetE2eChannelRow(...) 再创建 context。
 */
export function isolateBrowserChannels(browser, scriptName, opts = {}) {
  const ns = e2eChannelNs(scriptName);
  const origNewContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    // forceLocal 惰性求值（2026-08-25 顺序陷阱根治）：必须在 newContext
    // 调用时刻读取 cloudChannelUsable——若在 isolate 调用时提前固化，
    // 「先 isolate 后 reset」的合法顺序会把已就绪的云端通道错标为降级。
    // opts.forceLocal 显式钉死本地沙盒：p2p_broadcast 表就位后，未注入
    // 云端 ns 的单机考卷会自动切上 supabase 通道（共享行 oto 串台 +
    // rehydrate 提前引发 #418 全线回归）——设计假设纯本地的考卷必须显式钉死。
    const forceLocal = opts.forceLocal === true || !cloudChannelUsable;
    const ctx = await origNewContext(...args);
    await ctx.addInitScript(
      ({ value, forceLocal }) => {
        window.__OTO_CHANNEL_NS__ = value;
        if (forceLocal) window.__OTO_P2P_FORCE_LOCAL__ = true;
      },
      { value: ns, forceLocal }
    );
    if (opts.sandboxBotOff) {
      await ctx.addInitScript(() => {
        localStorage.setItem("oto-sandbox-bot", "off");
      });
    }
    return ctx;
  };
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

/**
 * 云端自清零：对本脚本专属行做空 state 覆盖（anon upsert 权限内完成，
 * 零 DDL 依赖）。无云凭据 → 本地通道模式，无需清云返回 false。
 */
export async function resetE2eChannelRow(scriptName) {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("placeholder")) {
    cloudChannelUsable = false;
    return false;
  }
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }),
      },
    });
    const { error } = await supabase
      .from("p2p_broadcast")
      .upsert({
        id: e2eChannelNs(scriptName),
        state: EMPTY_BUNDLE,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      cloudChannelUsable = false;
      console.warn(`[e2e-channel] ${scriptName} 自清零 warn:`, error.message);
      return false;
    }
    cloudChannelUsable = true;
    return true;
  } catch (e) {
    cloudChannelUsable = false;
    console.warn(`[e2e-channel] ${scriptName} 自清零异常:`, String(e).slice(0, 120));
    return false;
  }
}
