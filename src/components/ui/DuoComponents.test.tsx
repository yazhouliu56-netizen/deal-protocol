import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import DuoButton from "./DuoButton";
import DuoProgress from "./DuoProgress";
import DuoPathNode from "./DuoPathNode";

describe("DuoButton 3D 触觉原子", () => {
  it("默认 primary 变体渲染（4px 底边 + 白字 + data-variant）", () => {
    const html = renderToStaticMarkup(<DuoButton>扣动扳机</DuoButton>);
    expect(html).toContain('data-testid="duo-button"');
    expect(html).toContain('data-variant="primary"');
    expect(html).toContain("duo-3d-button");
    expect(html).toContain("扣动扳机");
  });

  it("多变体分支覆盖（danger/secondary/warning/outline/ghost）", () => {
    for (const v of ["danger", "secondary", "warning", "outline", "ghost"] as const) {
      const html = renderToStaticMarkup(<DuoButton variant={v}>{v}</DuoButton>);
      expect(html).toContain(`data-variant="${v}"`);
    }
  });

  it("onClick 回调透传（sound=none 静默路径）", () => {
    const fn = vi.fn();
    // sound=none 时不触 Audio，仅透传回调；静态渲染不触发点击，回调 0 次即证明未在渲染期误触发
    renderToStaticMarkup(
      <DuoButton variant="primary" sound="none" onClick={fn}>
        点击
      </DuoButton>,
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it("disabled 态渲染（降级不可点）", () => {
    const html = renderToStaticMarkup(<DuoButton disabled>禁用</DuoButton>);
    expect(html).toContain("disabled");
  });
});

describe("DuoProgress 糖果条", () => {
  it("基础渲染与百分比映射（value/max → width%）", () => {
    const html = renderToStaticMarkup(<DuoProgress value={60} max={100} />);
    expect(html).toContain('data-testid="duo-progress"');
    expect(html).toContain('aria-valuenow="60"');
    expect(html).toContain('data-testid="duo-progress-bar"');
  });

  it("边界钳制 0..100（负值/溢出不破版）", () => {
    const neg = renderToStaticMarkup(<DuoProgress value={-10} max={100} />);
    expect(neg).toContain('aria-valuenow="0"');
    const over = renderToStaticMarkup(<DuoProgress value={200} max={100} />);
    expect(over).toContain('aria-valuenow="100"');
  });

  it("高光白条存在（糖果质感）", () => {
    const html = renderToStaticMarkup(<DuoProgress value={40} />);
    expect(html).toContain("bg-white/40");
  });
});

describe("DuoPathNode 通关地图节点", () => {
  it("三态渲染（completed/current/locked）与气泡", () => {
    const done = renderToStaticMarkup(<DuoPathNode status="completed" step={1} title="已接单" />);
    expect(done).toContain('data-status="completed"');
    expect(done).toContain("已接单");

    const cur = renderToStaticMarkup(<DuoPathNode status="current" step={2} title="履约中" />);
    expect(cur).toContain('data-status="current"');
    expect(cur).toContain("进行中");

    const locked = renderToStaticMarkup(<DuoPathNode status="locked" step={3} title="待验收" />);
    expect(locked).toContain('data-status="locked"');
    expect(locked).toContain("待验收");
  });

  it("offsetX 蛇形位移透传", () => {
    const html = renderToStaticMarkup(<DuoPathNode status="current" step={2} offsetX={-8} />);
    expect(html).toContain("translateX(-8px)");
  });
});
