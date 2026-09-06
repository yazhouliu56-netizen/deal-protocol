/**
 * 临时实验：同一 KEY 下多 Gemini 模型分摊（round-robin + 串行 pacing）。
 * 复用真实管线 generateAmmoFromSentence，仅 completeFn 按句轮换模型直调。
 * 用法：node --experimental-transform-types --import ./scripts/node-ts-loader.mjs scripts/eval-model-spread.mjs
 * 需要 env: OPENCODE_GEMINI_KEY（脚本内映射为 Bearer，不过磁盘）。
 */
import { generateAmmoFromSentence } from "../src/adapters/ai/sentence-to-ammo.ts";
import { compileAmmoPrompt } from "../src/base/ai/prompt-compiler.ts";

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
];
const KEY = process.env.OPENCODE_GEMINI_KEY ?? "";
if (!KEY) {
  console.error("OPENCODE_GEMINI_KEY missing");
  process.exit(1);
}

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

async function modelComplete(model, args) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: args.messages,
        temperature: 0,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(args.timeoutMs ?? 30000),
    }
  );
  if (!res.ok) throw new Error(model + " HTTP " + res.status);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

let pass = 0;
const byModel = {};
for (let i = 0; i < SENTENCES.length; i += 1) {
  const sentence = SENTENCES[i];
  const model = MODELS[i % MODELS.length];
  byModel[model] ??= { pass: 0, total: 0 };
  byModel[model].total += 1;
  let r;
  try {
    r = await generateAmmoFromSentence(sentence, {
      timeoutMs: 30000,
      completeFn: (args) => modelComplete(model, args),
    });
  } catch (e) {
    console.log(`FAIL #${String(i + 1).padStart(2, "0")} [${model}] EXC ${String(e).slice(0, 100)}`);
    continue;
  }
  const dim = r.ok ? "PASS" : (r.failureDimension ?? "UNKNOWN");
  if (r.ok) {
    pass += 1;
    byModel[model].pass += 1;
  }
  console.log(
    `${r.ok ? "PASS" : "FAIL"} #${String(i + 1).padStart(2, "0")} [${model}] ${r.latencyMs}ms${r.autoRepaired ? " (repaired)" : ""}${r.ok ? "" : ` :: ${(r.errors ?? []).join("; ")}`}`
  );
  await new Promise((t) => setTimeout(t, 4000));
}
console.log(`\n[spread] 通过率 ${pass}/${SENTENCES.length}`);
for (const [m, s] of Object.entries(byModel)) console.log(`[spread] ${m}: ${s.pass}/${s.total}`);
if (pass < 14) process.exit(2);
