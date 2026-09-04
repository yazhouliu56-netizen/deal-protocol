/**
 * Step 2 · 文件→E2E 映射表 v1（detect-tier 与 verify-scoped 的唯一共享源）。
 * 规则 = 路径子串命中，粗但全；误命中可接受（多跑一条 e2e），漏命中由
 * smoke 退化 + 每周 CI 全量兜底。校准记录见本文件底部 CHANGELOG。
 */
export const SMOKE = ["e2e-app.mjs", "e2e-match.mjs"];

/** 生产态硬要求：dev-server 复用态下命中此集合必须先接管为自有 prod 实例。 */
export const NEEDS_PROD = new Set(["e2e-offline.mjs"]);

/** verify-prod 全量子集之外、可独立运行的手动专线。 */
export const MANUAL_ONLY = new Set([
  "e2e-four-ammos.mjs",
  "e2e-sos-hardware.mjs",
  "e2e-roam-multidevice.mjs",
]);

/** verify-prod suite 顺序（执行顺序即此序，保证与全量一致的可比性）。 */
export const SUITE_ORDER = [
  "e2e-app.mjs",
  "e2e-acceptance.mjs",
  "e2e-match.mjs",
  "e2e-openmatch.mjs",
  "e2e-push.mjs",
  "e2e-wave.mjs",
  "e2e-trust.mjs",
  "e2e-trust-open.mjs",
  "e2e-review.mjs",
  "e2e-fulfil.mjs",
  "e2e-governance.mjs",
  "e2e-offline.mjs",
  "e2e-dual-role-human.mjs",
];

/** 全部已知脚本名（含手动专线），--only 合法性校验用。 */
export const KNOWN = new Set([...SUITE_ORDER, ...MANUAL_ONLY]);

/** 命中规则：keys 任一为路径子串即命中（大小写敏感，v1 从简）。 */
export const RULES = [
  { e2e: "e2e-acceptance.mjs", keys: ["Publish", "ChatPage", "Draft", "Cabin", "PillBar", "registry", "factory"] },
  { e2e: "e2e-app.mjs", keys: ["src/app/page.tsx", "FloatingDock", "src/app/layout", "globals.css", "A2HS"] },
  { e2e: "e2e-match.mjs", keys: ["match", "Match", "broadcast", "Broadcast"] },
  { e2e: "e2e-openmatch.mjs", keys: ["penmatch", "OpenMatch", "openmatch"] },
  { e2e: "e2e-push.mjs", keys: ["push", "Push", "web-push", "vapid", "Vapid"] },
  { e2e: "e2e-wave.mjs", keys: ["Wave", "wave", "bidding", "Bidding"] },
  { e2e: "e2e-trust.mjs", keys: ["trust", "Trust", "credit", "Credit", "reputation", "Reputation", "violation"] },
  { e2e: "e2e-trust-open.mjs", keys: ["trust-open", "TrustOpen"] },
  { e2e: "e2e-review.mjs", keys: ["review", "Review"] },
  { e2e: "e2e-fulfil.mjs", keys: ["fulfil", "Fulfil", "arbitrat", "Arbitrat", "settlement", "Settlement", "escrow", "Escrow", "Fulfillment", "fulfillment"] },
  { e2e: "e2e-governance.mjs", keys: ["govern", "Govern", "moderation", "Moderation", "admission", "Admission", "sentinel", "Sentinel", "crisis", "Crisis"] },
  { e2e: "e2e-offline.mjs", keys: ["offline", "Offline", "OnlineStatus", "serwist", "Serwist", "service-worker", "ServiceWorker", "sw.ts"] },
  { e2e: "e2e-dual-role-human.mjs", keys: ["dual-role", "p2p", "P2P"] },
  { e2e: "e2e-four-ammos.mjs", keys: ["four-ammos", "four_ammos"] },
  { e2e: "e2e-sos-hardware.mjs", keys: ["sos-hardware", "SosHardware"] },
  { e2e: "e2e-roam-multidevice.mjs", keys: ["roam", "Roam", "multidevice"] },
];

export function matchE2E(files) {
  const hit = new Set();
  for (const f of files) {
    for (const r of RULES) {
      if (r.keys.some((k) => f.includes(k))) hit.add(r.e2e);
    }
  }
  const order = [...SUITE_ORDER, ...MANUAL_ONLY];
  return order.filter((s) => hit.has(s));
}

/* CHANGELOG
 * 2026-09-04 v1：初版。needsProd=true 仅 e2e-offline（SW 接管硬等待，磁盘实证）。
 * e2e-push 疑似需 SW，待 Step 4 dev/prod 对照校准后再定。
 * 2026-09-04 Step 4 校准结论：e2e-push 全文件零 SW/Notification 引用（代码实证），
 * A/B 双跑（自有 prod PASS / next dev 复用态 17.6s PASS）行为一致 → needsProd 保持 false。
 */
