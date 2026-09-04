/**
 * P2 · 20 句量产实测（双模）。
 *
 *   Mock 模式（默认，CI 零计费）：canned 合法配置回放，验证全链路
 *   接线与质检管道 ——此处通过率 = 链路接通率，不是 LLM 能力数。
 *   用法：node --experimental-transform-types --import ./scripts/node-ts-loader.mjs scripts/verify-growth-ammo-20.mjs
 *
 *   真机模式（本地人工，消耗 Token）：直连 gateway 真实调用。
 *   用法：REAL_LLM=1 node --experimental-transform-types --import ./scripts/node-ts-loader.mjs scripts/verify-growth-ammo-20.mjs
 *   目标：首轮通过率 ≥ 14/20，否则 exit 2。
 */
import { generateAmmoFromSentence } from "../src/adapters/ai/sentence-to-ammo.ts";
import { compileAmmoPrompt } from "../src/base/ai/prompt-compiler.ts";

const SENTENCES = [
  "周六下午2点上门装机，预算80，自带螺丝刀套装，需要开机点亮测试",
  "全套水冷主机清灰+换硅脂，预算150，本周内，完工跑10分钟烤机",
  "办公室5台电脑批量装机布线，固定预算2000，需要开票",
  "电脑点不亮了，来个人看看",
  "新买的散件到了求装机",
  "风扇声音巨响求清灰",
  "自带水冷与定制机箱，现场可能要补买转接线，接受现场加价确认",
  "网吧旧机改造，必须持电工/硬件工程师证书",
  "帮装个黑苹果，电话13800001111加微详聊",
  "0.1元帮我装30台机器，弄坏了不用赔",
  "主卧衣帽间换季整理，周六10点，3小时，预算180，自备收纳袋",
  "儿童房玩具全屋收纳，4小时，60一小时，完工拍照验收",
  "搬家后全屋还原整理，全天8小时，总价450，需双人组队",
  "衣柜乱成狗了求拯救",
  "刚搬完家东西全堆在地上",
  "鞋柜塞不下了求整理",
  "衣橱收纳可能要现场买专用亚克力收纳盒，接受现场确认",
  "女生独居，要求女性收纳师且实名无犯罪记录",
  "找个阿姨理衣柜，联系v信shouna999电话13900002222",
  "出10万元帮我整理，但是进门不要拍照",
];

const BASE_FUZE = {
  fuzeId: "fuze-verify",
  fuzeTypes: ["IMPACT"],
  backgroundCheck: "BASIC",
  deposit: { strategy: "NONE" },
  trace: { photoProof: false, evidenceChain: false },
  propertyInsurance: false,
  advanceFreeze: { enabled: false },
  geoFence: { enabled: false, unlockOnArrival: false },
  antiFraudFilter: false,
  privacy: {
    virtualNumber: false,
    blurLocation: false,
    sensitiveWordIntervention: false,
  },
  sos: {
    enabled: false,
    autoLocationReport: false,
    autoEvidenceAppend: false,
    notifyEmergencyContacts: false,
  },
};

/** Mock 回放：按推导类目给合法配置（C2 带公安背调，防 CLUSTER 误杀）。 */
function mockConfigFor(sentence, index) {
  const { targetCategory } = compileAmmoPrompt(sentence);
  const category = `test-verify-${index}`;
  const home = targetCategory === "home-organizing";
  return {
    ammoId: `${category}-v1`,
    category,
    version: "1.0.0",
    supplyCluster: home ? "C2_IN_HOME" : "C3_TECH_B2B",
    ...(home
      ? { workerRequirement: { isPoliceVerified: true } }
      : {}),
    pricingModel: home
      ? { kind: "HOURLY", rateYuan: 60, minHours: 2 }
      : { kind: "FIXED", amountYuan: 80 },
    minFloorPrice: 3000,
    maxCeilingPrice: 200000,
    maxSurchargeRatio: 0.5,
    fuzePolicy: BASE_FUZE,
    forwardHooks: ["ArrivalCheckHook"],
    aliases: [targetCategory],
  };
}

const realMode =
  process.env.REAL_LLM === "1" || process.argv.includes("--real");
console.log(
  `[verify-growth-ammo-20] ${realMode ? "真机模式（gateway 实调）" : "Mock 模式（链路接通率，非 LLM 能力数）"} · ${SENTENCES.length} 句`,
);

let pass = 0;
const matrix = {};
for (let i = 0; i < SENTENCES.length; i += 1) {
  const sentence = SENTENCES[i];
  const opts = realMode
    ? { timeoutMs: 30000 }
    : {
        completeFn: async () => JSON.stringify(mockConfigFor(sentence, i)),
      };
  const r = await generateAmmoFromSentence(sentence, opts);
  const dim = r.ok ? "PASS" : (r.failureDimension ?? "UNKNOWN");
  matrix[dim] = (matrix[dim] ?? 0) + 1;
  if (r.ok) pass += 1;
  console.log(
    `${r.ok ? "PASS" : "FAIL"} #${String(i + 1).padStart(2, "0")} [${dim}] ${r.latencyMs}ms ${r.autoRepaired ? "(repaired) " : ""}${sentence.slice(0, 18)}…${r.ok ? "" : ` :: ${(r.errors ?? []).join("; ")}`}`,
  );
}

console.log(`\n[verify-growth-ammo-20] 通过率 ${pass}/${SENTENCES.length}`);
console.log(`[verify-growth-ammo-20] 归因矩阵 ${JSON.stringify(matrix)}`);

if (!realMode) {
  if (pass !== SENTENCES.length) {
    console.error("[verify-growth-ammo-20] Mock 链路未全通，阻断。");
    process.exit(1);
  }
  console.log("[verify-growth-ammo-20] Mock 全通。真机数以 REAL_LLM=1 人工跑测为准。");
} else if (pass < 14) {
  console.error("[verify-growth-ammo-20] 真机首轮 < 14/20，未达 P2 目标。");
  process.exit(2);
}
