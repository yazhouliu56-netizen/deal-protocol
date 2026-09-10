import { describe, expect, it } from "vitest";

import { speak } from "./speak";

describe("speak SSR 安全", () => {
  it("无 window 环境静默 false，不抛（#10）", () => {
    expect(speak("")).toBe(false);
    expect(speak("发射成功")).toBe(false);
  });
});
