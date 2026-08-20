// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import LoginPage from "./page";

describe("/login 服务端重定向收口（老版全页登录已迁 /dp/login）", () => {
  beforeEach(() => redirectMock.mockReset());

  it("服务端 307 重定向至 /?auth=open（前台 AuthSheet 唤起口径）", () => {
    LoginPage();
    expect(redirectMock).toHaveBeenCalledWith("/?auth=open");
  });
});