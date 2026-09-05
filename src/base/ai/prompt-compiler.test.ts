/**
 * P1 提示词编译器考卷（node:test）：20 句真题断言 + 脱敏校验 + 边界与确定性。
 * 数据源：docs/GROWTH-SEED-20.md 落盘字符串（严禁对虚构串做空断言）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compileAmmoPrompt,
  COMPILER_ALLOWED_HOOKS,
  COMPILER_PRICE_CEILING_CENTS,
  COMPILER_PRICE_FLOOR_CENTS,
} from "./prompt-compiler.ts";

/** 男盘 M01~M10（P0 实际落盘语）。 */
const MALE_SENTENCES: string[] = [
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
];

/** 女盘 F01~F10（P0 实际落盘语）。 */
const FEMALE_SENTENCES: string[] = [
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

test("男盘标准句推导 pc-assembly（M01~M03）", () => {
  for (const s of MALE_SENTENCES.slice(0, 3)) {
    assert.equal(compileAmmoPrompt(s).targetCategory, "pc-assembly", s);
  }
});

test("男盘口语句缺省兜底不抛异常（M04~M06）", () => {
  const r04 = compileAmmoPrompt(MALE_SENTENCES[3]);
  assert.equal(r04.targetCategory, "pc-assembly");
  assert.match(r04.userPrompt, /FIXED 装机费 80 元/);
  assert.equal(compileAmmoPrompt(MALE_SENTENCES[4]).targetCategory, "pc-assembly");
  assert.equal(compileAmmoPrompt(MALE_SENTENCES[5]).targetCategory, "pc-assembly");
});

test("男盘增项约束句保留原意（M07~M08）", () => {
  const r07 = compileAmmoPrompt(MALE_SENTENCES[6]);
  assert.equal(r07.targetCategory, "pc-assembly");
  assert.match(r07.sanitizedInput, /转接线/);
  const r08 = compileAmmoPrompt(MALE_SENTENCES[7]);
  assert.match(r08.sanitizedInput, /证书/);
});

test("M09 脱敏：13800001111 零明文残留且检出", () => {
  const r = compileAmmoPrompt(MALE_SENTENCES[8]);
  assert.equal(r.detectedLeak, true);
  assert.doesNotMatch(r.sanitizedInput, /13800001111/);
  assert.match(r.sanitizedInput, /138\*\*\*\*1111/);
  assert.doesNotMatch(r.userPrompt, /13800001111/);
  assert.doesNotMatch(r.systemPrompt, /13800001111/);
});

test("M10 地板价钳制 3000 分", () => {
  const r = compileAmmoPrompt(MALE_SENTENCES[9]);
  assert.ok(r.constraints.priceBounds.floorCents >= 3000);
  assert.equal(r.constraints.priceBounds.floorCents, COMPILER_PRICE_FLOOR_CENTS);
});

test("女盘标准句推导 home-organizing（F01~F03）", () => {
  for (const s of FEMALE_SENTENCES.slice(0, 3)) {
    assert.equal(compileAmmoPrompt(s).targetCategory, "home-organizing", s);
  }
});

test("女盘口语句缺省兜底不抛异常（F04~F06）", () => {
  const r04 = compileAmmoPrompt(FEMALE_SENTENCES[3]);
  assert.equal(r04.targetCategory, "home-organizing");
  assert.match(r04.userPrompt, /HOURLY 60 元\/时/);
  assert.equal(compileAmmoPrompt(FEMALE_SENTENCES[4]).targetCategory, "home-organizing");
  assert.equal(compileAmmoPrompt(FEMALE_SENTENCES[5]).targetCategory, "home-organizing");
});

test("女盘增项约束句保留原意（F07~F08）", () => {
  assert.match(compileAmmoPrompt(FEMALE_SENTENCES[6]).sanitizedInput, /亚克力/);
  assert.match(compileAmmoPrompt(FEMALE_SENTENCES[7]).sanitizedInput, /女性收纳师/);
});

test("F09 脱敏：13900002222 与 shouna999 零明文残留且检出", () => {
  const r = compileAmmoPrompt(FEMALE_SENTENCES[8]);
  assert.equal(r.detectedLeak, true);
  assert.doesNotMatch(r.sanitizedInput, /13900002222/);
  assert.doesNotMatch(r.sanitizedInput, /shouna999/);
  assert.match(r.sanitizedInput, /139\*\*\*\*2222/);
  assert.match(r.sanitizedInput, /微信号已脱敏/);
  assert.doesNotMatch(r.userPrompt, /13900002222/);
});

test("F10 天花板价钳制 200000 分", () => {
  const r = compileAmmoPrompt(FEMALE_SENTENCES[9]);
  assert.ok(r.constraints.priceBounds.ceilingCents <= 200000);
  assert.equal(r.constraints.priceBounds.ceilingCents, COMPILER_PRICE_CEILING_CENTS);
});

test("约束锁死：systemPrompt 含六算子白名单与护栏数字", () => {
  const r = compileAmmoPrompt("电脑点不亮了，来个人看看");
  for (const h of COMPILER_ALLOWED_HOOKS) {
    assert.match(r.systemPrompt, new RegExp(h), h);
  }
  assert.deepEqual(r.constraints.allowedHooks, [...COMPILER_ALLOWED_HOOKS]);
  assert.match(r.systemPrompt, /IHolographicAmmoConfig/);
  assert.match(r.systemPrompt, /3000/);
  assert.match(r.systemPrompt, /200000/);
  assert.deepEqual(r.constraints.allowedClusters, [
    "C1_MOBILITY",
    "C2_IN_HOME",
    "C3_TECH_B2B",
  ]);
  assert.deepEqual(r.constraints.allowedPricingKinds, [
    "FIXED",
    "HOURLY",
    "PER_SEAT",
    "FORMULA",
  ]);
});

test("C2入户安全底线：systemPrompt与home缺省均声明isPoliceVerified", () => {
  const r = compileAmmoPrompt("电脑点不亮了，来个人看看");
  assert.match(r.systemPrompt, /C2_IN_HOME/);
  assert.match(r.systemPrompt, /workerRequirement\.isPoliceVerified=true/);
  const home = compileAmmoPrompt(FEMALE_SENTENCES[3]);
  assert.match(home.userPrompt, /workerRequirement\.isPoliceVerified=true/);
});

test("20 句全量无异常且无 PII 明文进提示词", () => {
  const leaks = ["13800001111", "13900002222", "shouna999"];
  for (const s of [...MALE_SENTENCES, ...FEMALE_SENTENCES]) {
    const r = compileAmmoPrompt(s);
    assert.ok(r.systemPrompt.length > 0 && r.userPrompt.length > 0, s);
    for (const leak of leaks) {
      assert.doesNotMatch(r.userPrompt, new RegExp(leak), `${s} / ${leak}`);
    }
  }
});

test("确定性：同输入双次调用字节一致", () => {
  const s = "自带水冷与定制机箱，现场可能要补买转接线，接受现场加价确认";
  assert.deepEqual(compileAmmoPrompt(s), compileAmmoPrompt(s));
  assert.deepEqual(
    compileAmmoPrompt(s, { now: 123 }),
    compileAmmoPrompt(s, { now: 123 }),
  );
});

test("categoryHint 显式覆盖关键词推导", () => {
  assert.equal(
    compileAmmoPrompt("帮忙看看", { categoryHint: "pc-assembly" }).targetCategory,
    "pc-assembly",
  );
  assert.equal(
    compileAmmoPrompt("电脑点不亮了，来个人看看", {
      categoryHint: "home-organizing",
    }).targetCategory,
    "home-organizing",
  );
});

test("畸形输入降级：空串与非串不抛异常", () => {
  assert.equal(compileAmmoPrompt("").targetCategory, "general");
  assert.equal(
    compileAmmoPrompt(undefined as unknown as string).targetCategory,
    "general",
  );
});
