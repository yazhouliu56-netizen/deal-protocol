// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RootNotFound from "@/app/not-found";
import RootError from "@/app/error";
import DemandLoading from "@/app/demands/[id]/loading";

describe("Batch② 根级 loading/error 矩阵", () => {
  it("not-found：Duo 白底卡 + 回首页入口", () => {
    const html = renderToStaticMarkup(<RootNotFound />);
    expect(html).toContain('data-testid="root-not-found"');
    expect(html).toContain("页面走丢了");
    expect(html).toContain('data-testid="root-not-found-home"');
    expect(html).toContain('href="/"');
  });

  it("error：Duo 白底卡 + 重试回调走 unstable_retry（16.2 契约）", () => {
    const html = renderToStaticMarkup(
      <RootError error={new Error("boom")} unstable_retry={() => {}} />,
    );
    expect(html).toContain('data-testid="root-error"');
    expect(html).toContain("页面开小差了");
    expect(html).toContain('data-testid="root-error-retry"');
    expect(html).toContain("boom");
  });

  it("error：digest 透出便于服务端日志对账", () => {
    const err = new Error("x") as Error & { digest?: string };
    err.digest = "abc123";
    const html = renderToStaticMarkup(<RootError error={err} unstable_retry={() => {}} />);
    expect(html).toContain("abc123");
  });

  it("demands/[id]/loading：骨架屏占位", () => {
    const html = renderToStaticMarkup(<DemandLoading />);
    expect(html).toContain('data-testid="demand-detail-loading"');
  });

  it("global-error：自带 document（构建期已由 next 校验，此处锁文件存在）", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/app/global-error.tsx", "utf8");
    expect(src).toContain("<html");
    expect(src).toContain("<body");
    expect(src).toContain("unstable_retry");
    expect(src).not.toContain("var(--color-duo-");
  });
});
