// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import RegisterPage from "./page";

describe("/register 服务端重定向收口（老版注册页已随登录迁 /dp/login）", () => {
  beforeEach(() => redirectMock.mockReset());

  it("服务端 307 重定向至 /?auth=open（前台 AuthSheet 唤起口径）", () => {
    RegisterPage();
    expect(redirectMock).toHaveBeenCalledWith("/?auth=open");
  });
});