import { describe, expect, it } from "vitest";

import { playClick, playCorrect, playError } from "./duo-audio";

describe("duo-audio SSR 安全", () => {
  it("Node/SSR 环境 0ms 静默不抛错（宪法 #10）", () => {
    expect(() => playClick()).not.toThrow();
    expect(() => playCorrect()).not.toThrow();
    expect(() => playError()).not.toThrow();
  });

  it("连续调用不抛错（幂等）", () => {
    for (let i = 0; i < 5; i++) {
      expect(() => playClick()).not.toThrow();
    }
    expect(() => playCorrect()).not.toThrow();
  });
});
