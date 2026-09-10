import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CopilotReplies, { QUICK_REPLIES } from "./CopilotReplies";

describe("CopilotReplies static", () => {
  it("三条标准回复 chips", () => {
    const html = renderToStaticMarkup(<CopilotReplies />);
    expect(html).toContain("copilot-replies");
    expect(html).toContain("快捷回复");
    expect(QUICK_REPLIES).toHaveLength(3);
    for (const q of QUICK_REPLIES) {
      expect(html).toContain(q.slice(0, 10));
    }
  });
});
