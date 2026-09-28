import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ConfirmArrivalButton from "./ConfirmArrivalButton";

describe("ConfirmArrivalButton 静态渲染", () => {
  it("首帧 idle：确认按钮在位（effect 未跑，不断言网络）", () => {
    const html = renderToStaticMarkup(<ConfirmArrivalButton demandId="d-1" />);
    expect(html).toContain('data-testid="confirm-arrival"');
    expect(html).toContain("师傅到了");
  });
});
