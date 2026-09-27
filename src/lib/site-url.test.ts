import { describe, it, expect, afterEach } from "vitest";
import { getSiteUrl } from "./site-url";

const KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_URL", "NODE_ENV"] as const;
const saved = new Map<string, string | undefined>();

function setup() {
  for (const k of KEYS) {
    if (!saved.has(k)) saved.set(k, process.env[k]);
  }
}

function restore() {
  for (const [k, v] of saved) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  saved.clear();
}

describe("getSiteUrl（Vercel env 收敛）", () => {
  afterEach(restore);

  it("显式值优先（Production）", () => {
    setup();
    process.env.NEXT_PUBLIC_SITE_URL = "https://deal-protocol.vercel.app/";
    process.env.VERCEL_URL = "preview-xxx.vercel.app";
    expect(getSiteUrl()).toBe("https://deal-protocol.vercel.app");
  });

  it("Preview 无显式值时读 VERCEL_URL 并补协议头", () => {
    setup();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = "deal-protocol-git-preview.vercel.app";
    expect(getSiteUrl()).toBe("https://deal-protocol-git-preview.vercel.app");
  });

  it("本地回退 localhost", () => {
    setup();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    // vitest 下 NODE_ENV 已为 test，直断回退值。
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
