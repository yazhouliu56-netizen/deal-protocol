import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HaggleTable, { HaggleConfirmCard } from "./HaggleTable";
import { claimToHaggleCard } from "@/base/order/haggle";

const noop = () => {};

describe("HaggleTable static", () => {
  it("三档发送链＋超均值警示", () => {
    const html = renderToStaticMarkup(
      <HaggleTable quoteYuan={150} quotesYuan={[150, 100, 100]} budgetYuan={200} rounds={1} onSend={noop} />,
    );
    expect(html).toContain("haggle-table");
    expect(html).toContain("爽快拿下");
    expect(html).toContain("小让 5%");
    expect(html).toContain("守底价");
    expect(html).toContain("haggle-fair-warn");
  });

  it("无报价不警示＋3轮锁死", () => {
    const html = renderToStaticMarkup(
      <HaggleTable quoteYuan={150} quotesYuan={[]} budgetYuan={200} rounds={3} onSend={noop} />,
    );
    expect(html).toContain("暂无比价");
    expect(html).not.toContain("haggle-fair-warn");
    expect(html).toContain("3 轮已满");
  });

  it("T2 确认卡：改价渲染谈成价＋发射", () => {
    const card = claimToHaggleCard(
      { id: "c1", price: 130, responderId: "resp-abc123" },
      { id: "w1", budget: 150, basics: { time: "明晚", category: "保洁" } },
      1000,
    );
    const html = renderToStaticMarkup(<HaggleConfirmCard card={card!} onConfirm={noop} onBack={noop} />);
    expect(html).toContain("haggle-confirm");
    expect(html).toContain("¥130");
    expect(html).toContain("发射");
  });
});
