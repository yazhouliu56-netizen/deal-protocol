import { describe, expect, it } from "vitest";

import { RISE_6, RISE_8, RISE_10 } from "./motion";

describe("入场动效三档（P10-3）", () => {
  it("三档位移值：6 / 8 / 10，终态归零", () => {
    expect(RISE_6.initial).toEqual({ opacity: 0, y: 6 });
    expect(RISE_8.initial).toEqual({ opacity: 0, y: 8 });
    expect(RISE_10.initial).toEqual({ opacity: 0, y: 10 });
    for (const p of [RISE_6, RISE_8, RISE_10]) {
      expect(p.animate).toEqual({ opacity: 1, y: 0 });
    }
  });

  it("spread 扩展不污染正典（ARPage height / DynamicDraftCard scale 形态）", () => {
    const extended = { ...RISE_10.initial, height: 0 };
    expect(extended).toEqual({ opacity: 0, y: 10, height: 0 });
    expect(RISE_10.initial).toEqual({ opacity: 0, y: 10 });
  });
});
