import { describe, expect, it } from "vitest";
import {
  CIVIL_CODE_ARTICLES,
  CIVIL_CODE_NUMBERS,
  civilCodePromptBlock,
  precedentsPromptBlock,
  rankPrecedents,
} from "./civil-code";

describe("准据法条＋先例", () => {
  it("条文库：12 条现行条文号锁定（防幻觉漂移）", () => {
    expect([...CIVIL_CODE_NUMBERS]).toEqual([
      "509", "563", "566", "577", "578", "580", "582", "584", "585", "590", "591", "592",
    ]);
    expect(CIVIL_CODE_ARTICLES.length).toBe(12);
    for (const a of CIVIL_CODE_ARTICLES) {
      expect(a.title.includes(a.code)).toBe(false);
      expect(a.gist.length > 0 && a.applies.length > 0).toBe(true);
    }
  });

  it("prompt 块：含全部条文号＋禁编造令", () => {
    const block = civilCodePromptBlock();
    for (const n of CIVIL_CODE_NUMBERS) expect(block).toContain(n);
    expect(block).toContain("严禁编造条文号");
    expect(block).toContain("无直接对应条文");
  });

  it("先例排序：关键词交集＋binding 次序＋空安全", () => {
    const rows = [
      { summary: "保洁迟到两小时", ruling_principle: "按比例扣减", binding: false },
      { summary: "无关事项", ruling_principle: "驳回", binding: true },
    ];
    const ranked = rankPrecedents(rows, "保洁人员迟到引发争议");
    expect(ranked.length).toBe(1);
    expect(ranked[0].summary).toBe("保洁迟到两小时");
    expect(rankPrecedents(rows, "火星开矿")).toEqual([]);
    expect(rankPrecedents([], "保洁迟到")).toEqual([]);
    expect(precedentsPromptBlock([])).toBe("");
    expect(precedentsPromptBlock(ranked)).toContain("库内相关先例");
  });
});
