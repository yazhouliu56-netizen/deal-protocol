import { describe, expect, it } from "vitest";
import {
  BANDIT_EPSILON_WEEKDAY,
  BANDIT_EPSILON_WEEKEND,
  BanditRanker,
  epsilonFor,
} from "./bandit-ranker";

describe("epsilonFor 探索率档位（B 口径＋周末加量）", () => {
  it("工作日 5%，周末 10%（连续 14 天逐日断言，时区无关）", () => {
    const monday = new Date(2026, 8, 21).getTime();
    for (let d = 0; d < 14; d++) {
      const nowMs = monday + d * 86400000;
      const day = new Date(nowMs).getDay();
      const expected =
        day === 0 || day === 6 ? BANDIT_EPSILON_WEEKEND : BANDIT_EPSILON_WEEKDAY;
      expect(epsilonFor(nowMs)).toBe(expected);
    }
    expect(BANDIT_EPSILON_WEEKDAY).toBe(0.05);
    expect(BANDIT_EPSILON_WEEKEND).toBe(0.1);
  });

  it("缺省构造即当时档位；显式传参仍尊重（既有调用零漂移）", () => {
    const saturday = new Date(2026, 8, 26).getTime();
    expect(new BanditRanker(epsilonFor(saturday)).getEpsilon()).toBe(0.1);
    expect(new BanditRanker(0.2).getEpsilon()).toBe(0.2);
  });
});
