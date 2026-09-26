/**
 * 实名核验厂商适配层考卷（node:test）：Mock 确定性＋vendor 优先＋异常回落。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mockFaceLiveness,
  mockThreeElements,
  verifyFaceLiveness,
  verifyThreeElements,
} from "./realname-verify.ts";

const GOOD = { realName: "王姐", idNumber: "110101199001011234", phone: "13800001111" };

test("Mock 三要素：全对过，缺项/错格式逐项拦", async () => {
  assert.deepEqual(await mockThreeElements(GOOD), { ok: true, provider: "mock" });
  assert.equal((await mockThreeElements({ ...GOOD, realName: "王" })).ok, false);
  assert.equal((await mockThreeElements({ ...GOOD, idNumber: "123" })).ok, false);
  assert.equal((await mockThreeElements({ ...GOOD, phone: "123456" })).ok, false);
});

test("Mock 活体：非空过，空拦", async () => {
  assert.equal((await mockFaceLiveness({ imageRef: "oss://face/1.jpg" })).ok, true);
  assert.equal((await mockFaceLiveness({ imageRef: "  " })).ok, false);
});

test("统一入口：无 vendor key 回落 Mock（provider 留痕）", async () => {
  delete process.env.REALNAME_API_KEY;
  const r = await verifyThreeElements(GOOD);
  assert.equal(r.ok, true);
  assert.equal(r.provider, "mock");
});

test("统一入口：vendor 抛错回落 Mock 不抛", async () => {
  const r = await verifyThreeElements(GOOD, {
    vendor: async () => {
      throw new Error("vendor down");
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.provider, "mock");
});

test("统一入口：vendor 命中即采用（provider 透出）", async () => {
  const r = await verifyFaceLiveness(
    { imageRef: "x" },
    { vendor: async () => ({ ok: true, provider: "aliyun" }) },
  );
  assert.deepEqual(r, { ok: true, provider: "aliyun" });
});
