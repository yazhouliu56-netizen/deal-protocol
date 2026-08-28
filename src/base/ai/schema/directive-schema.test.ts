import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createDirectiveSchema,
  safeParseDirective,
  safeParseCustomIntent,
  safeParseDecomposeDraft,
} from "./directive-schema.ts";

describe("directive-schema — 合法载荷全解析", () => {
  it("合法 Directive 全字段直通（text/action/category/need/confidence/scores）", () => {
    const input = {
      text: "  hello world  ",
      action: "ask",
      category: "housekeeping",
      need: { area: "  幸福家园  ", budget: 100, level: "A" },
      confidence: 0.9,
      scores: { a: 0.8, b: 0.2 },
    };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.text, "hello world");
      assert.equal(r.data.action, "ask");
      assert.equal(r.data.category, "housekeeping");
      assert.equal(r.data.need?.area, "幸福家园");
      assert.equal(r.data.need?.budget, 100);
      assert.equal(r.data.confidence, 0.9);
      assert.equal(r.data.scores?.a, 0.8);
    }
  });

  it("字符串 JSON 输入自动去围栏提取（```json 包裹）", () => {
    const raw = '```json\n{"text":"hi","action":"done","category":"pet-boarding-v1"}\n```';
    const r = safeParseDirective(raw);
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.category, "pet-boarding-v1");
  });

  it("slots 别名字段自动归一到 need（不覆盖 need 已有键）", () => {
    const input = {
      text: "hi",
      action: "slots",
      category: null,
      need: { area: "A" },
      slots: { area: "B", budget: 200, extra: "x" },
    };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.need?.area, "A");
      assert.equal(r.data.need?.budget, 200);
      // extra 来自 slots 的动态槽位也保留
      assert.equal((r.data.need as Record<string, unknown>).extra, "x");
    }
  });
});

describe("directive-schema — 动态品类注入", () => {
  it("命中白名单直通", () => {
    const raw = JSON.stringify({ text: "hi", action: "ask", category: "pet-boarding-v1" });
    const r = safeParseDirective(raw, { availableCategories: ["pet-boarding-v1", "appliance-repair-v1"] });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.category, "pet-boarding-v1");
  });

  it("未命中白名单安全归一为 null", () => {
    const raw = JSON.stringify({ text: "hi", action: "ask", category: "drone-crop-spray-v1" });
    const r = safeParseDirective(raw, { availableCategories: ["pet-boarding-v1"] });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.category, null);
  });

  it("无白名单时任意字符串透传（兼容旧链路）", () => {
    const input = { text: "hi", action: "ask", category: "housekeeping" };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.category, "housekeeping");
  });

  it("createDirectiveSchema 工厂动态派生隔离（不同白名单互不干扰）", () => {
    const s1 = createDirectiveSchema(["a"]);
    const s2 = createDirectiveSchema(["b"]);
    const r1 = s1.safeParse({ text: "hi", action: "ask", category: "a" });
    const r2 = s2.safeParse({ text: "hi", action: "ask", category: "a" });
    assert.equal(r1.success, true);
    assert.equal(r2.success, true);
    if (r1.success && r2.success) {
      assert.equal(r1.data.category, "a");
      assert.equal(r2.data.category, null);
    }
  });
});

describe("directive-schema — 非法类型与清洗", () => {
  it("文本字段 trim + 控制字符过滤", () => {
    const input = { text: "  hel\u0000lo\u001F  ", action: "ask", category: "  housekeeping \u0000" };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.text, "hello");
      assert.equal(r.data.category, "housekeeping");
    }
  });

  it("非法类型字段清洗（category 非字符串归 null，need 非法值丢弃）", () => {
    const input = {
      text: "hi",
      action: "ask",
      category: 123 as unknown,
      need: { area: { obj: 1 } as unknown, budget: "100", level: null as unknown },
    };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.category, null);
      // 非法 need 值被丢弃，仅 budget 字符串被清洗保留
      assert.equal(r.data.need?.budget, "100");
      assert.equal(r.data.need?.area, undefined);
      assert.equal(r.data.need?.level, undefined);
    }
  });

  it("confidence/scores 数值钳制 [0,1]，越界/NaN 过滤", () => {
    const input = {
      text: "hi",
      action: "ask",
      category: null,
      confidence: 2.5,
      scores: { a: -0.5, b: 1.5, c: Number.NaN as unknown as number, d: 0.5 },
    };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.confidence, 1);
      assert.equal(r.data.scores?.a, 0);
      assert.equal(r.data.scores?.b, 1);
      assert.equal(r.data.scores?.d, 0.5);
      assert.equal(r.data.scores?.c, undefined);
    }
  });

  it("非法 action 直接失败并返回 fallback（不抛异常）", () => {
    const input = { text: "hi", action: "unknown", category: null };
    const r = safeParseDirective(input);
    assert.equal(r.success, false);
    if (!r.success) {
      assert.equal(r.fallback.action, "ask");
      assert.equal(r.fallback.category, null);
    }
  });

  it("budget/time 字段类型自适应（字符串数字归一，非法丢弃）", () => {
    const input = { text: "hi", action: "done", category: null, budget: " 160 ", time: " 明天 10:00 \u0000" };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.budget, 160);
      assert.equal(r.data.time, "明天 10:00");
    }
  });
});

describe("directive-schema — 深度嵌套与原型污染防御", () => {
  it("原型污染 __proto__ 在顶层被过滤（不污染 Object.prototype）", () => {
    const input = JSON.parse('{"text":"hi","action":"ask","category":null,"__proto__":{"polluted":1}}');
    const before = ({} as Record<string, unknown>).polluted;
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    const after = ({} as Record<string, unknown>).polluted;
    assert.equal(before, undefined);
    assert.equal(after, undefined);
    assert.equal((Object.prototype as unknown as Record<string, unknown>).polluted, undefined);
  });

  it("need/slots 中的 __proto__/constructor/prototype 被过滤", () => {
    const input = {
      text: "hi",
      action: "ask",
      category: null,
      need: { area: "A", __proto__: { polluted: 1 } } as unknown as Record<string, unknown>,
      slots: { __proto__: "x", budget: 100 } as unknown as Record<string, unknown>,
    };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.need?.area, "A");
      //  merged slots budget 100 应进入 need（need 优先 + slots 补充）
      assert.equal(r.data.need?.budget, 100);
      assert.equal(Object.prototype.hasOwnProperty.call(r.data.need ?? {}, "__proto__"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(r.data.need ?? {}, "constructor"), false);
      // slots 本身若保留也需无污染；当前实现 slots 已归一到 need，单独 slots 为 undefined 或已清洗
      if (r.data.slots) {
        assert.equal(Object.prototype.hasOwnProperty.call(r.data.slots, "__proto__"), false);
      }
      assert.equal((Object.prototype as unknown as Record<string, unknown>).polluted, undefined);
    }
  });

  it("深层嵌套脏对象（need 值为对象/数组）被丢弃，仅保留 string|number", () => {
    const input = {
      text: "hi",
      action: "ask",
      category: null,
      need: { area: { city: "A" } as unknown, budget: [100] as unknown, level: "B" },
    };
    const r = safeParseDirective(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.need?.area, undefined);
      assert.equal(r.data.need?.budget, undefined);
      assert.equal(r.data.need?.level, "B");
    }
  });

  it("JSON 字符串中的原型污染载荷同样被清洗（字符串输入路径）", () => {
    const raw = '{"text":"hi","action":"ask","category":null,"need":{"__proto__":{"polluted":1},"area":"A"}}';
    const r = safeParseDirective(raw);
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.need?.area, "A");
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });
});

describe("directive-schema — 空输入安全兜底", () => {
  it("null/undefined/空字符串/非对象均返回 fallback 且不抛异常", () => {
    const cases: unknown[] = [null, undefined, "", "   ", "no-json", 123, true, [], new Date()];
    for (const c of cases) {
      const r = safeParseDirective(c as unknown);
      assert.equal(r.success, false);
      if (!r.success) {
        assert.equal(r.fallback.action, "ask");
        assert.equal(r.fallback.category, null);
        assert.equal(typeof r.fallback.text, "string");
      }
    }
  });

  it("缺失必填字段（text/action）返回 fallback，error 含 ZodIssue", () => {
    const r = safeParseDirective({ category: null });
    assert.equal(r.success, false);
    if (!r.success) {
      assert.ok(r.error.issues.length > 0);
      assert.equal(r.fallback.text, "");
    }
  });

  it("0ms 产出（同步纯函数，无异步 I/O）", () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) safeParseDirective({ text: "hi", action: "ask", category: null, need: { area: "A" } });
    assert.ok(Date.now() - start < 200);
  });
});

describe("directive-schema — CustomIntent 清洗", () => {
  it("合法 CustomIntent 全字段通过", () => {
    const input = {
      dressCode: { required: true, type: "THEMED_MAID", rawKeyword: "女仆装" },
      ageRange: [20, 30] as [number, number],
      genderPreference: "FEMALE" as const,
      cleanText: "  要求：女仆  ",
      isSensitiveCustomization: true,
      blockedReason: null,
    };
    const r = safeParseCustomIntent(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.dressCode?.type, "THEMED_MAID");
      assert.deepEqual(r.data.ageRange, [20, 30]);
      assert.equal(r.data.genderPreference, "FEMALE");
      assert.equal(r.data.cleanText, "要求：女仆");
    }
  });

  it("CustomIntent 字符串输入归一为 cleanText 兜底（不抛异常）", () => {
    const r = safeParseCustomIntent("  穿 JK 制服  \u0000");
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.cleanText, "穿 JK 制服");
      assert.equal(r.data.isSensitiveCustomization, false);
      assert.equal(r.data.blockedReason, null);
    }
  });

  it("CustomIntent 非法 ageRange/ dressCode 被拒并 fallback", () => {
    const r = safeParseCustomIntent({ ageRange: [5, 200] as unknown, dressCode: { required: true, type: "UNKNOWN" as unknown, rawKeyword: "" } });
    assert.equal(r.success, false);
    if (!r.success) assert.equal(r.fallback.cleanText, "");
  });

  it("CustomIntent 原型污染过滤与空兜底", () => {
    const input = JSON.parse('{"cleanText":"hi","__proto__":{"polluted":1}}');
    const r = safeParseCustomIntent(input);
    assert.equal(r.success, true);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    const r2 = safeParseCustomIntent(null);
    assert.equal(r2.success, false);
    if (!r2.success) assert.equal(r2.fallback.blockedReason, null);
  });
});

describe("directive-schema — DecomposeDraft 清洗", () => {
  it("合法 DecomposeDraft（modules 权重和 100）通过", () => {
    const input = {
      modules: [
        { name: " 刷墙 ", acceptance: " 验收通过 ", weight: 60 },
        { name: "保洁", acceptance: "干净", weight: 40 },
      ],
      source: "llm" as const,
      budget: 1000,
    };
    const r = safeParseDecomposeDraft(input);
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.modules[0].name, "刷墙");
      assert.equal(r.data.modules[0].acceptance, "验收通过");
      assert.equal(r.data.modules.length, 2);
    }
  });

  it("DecomposeDraft 非法 modules（空/权重和非 100/空名）fallback", () => {
    const r1 = safeParseDecomposeDraft({ modules: [] });
    assert.equal(r1.success, false);
    const r2 = safeParseDecomposeDraft({ modules: [{ name: "a", acceptance: "b", weight: 30 }, { name: "c", acceptance: "d", weight: 30 }] });
    assert.equal(r2.success, false);
    const r3 = safeParseDecomposeDraft({ modules: [{ name: " ", acceptance: "x", weight: 100 }] });
    assert.equal(r3.success, false);
  });

  it("DecomposeDraft 控制字符过滤与原型污染防御", () => {
    const input = {
      modules: [{ name: "a\u0000", acceptance: "b\u001F", weight: 100 }],
      __proto__: { polluted: 1 } as unknown,
    };
    const r = safeParseDecomposeDraft(input);
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.modules[0].name, "a");
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });

  it("DecomposeDraft 空/非法输入兜底不抛异常", () => {
    for (const c of [null, undefined, "str", 123, [], { noModules: 1 }]) {
      const r = safeParseDecomposeDraft(c as unknown);
      assert.equal(r.success, false);
      if (!r.success) assert.deepEqual(r.fallback.modules, []);
    }
  });
});
