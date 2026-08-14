import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWaveUrl } from "./scan.ts";

test("parseWaveUrl: 完整分享 URL（ShareKit 形态）", () => {
  assert.equal(
    parseWaveUrl("https://oto.example/?wave=w-001&via=u-42"),
    "w-001"
  );
});

test("parseWaveUrl: 本地主机 + 端口", () => {
  assert.equal(
    parseWaveUrl("http://localhost:3000/?wave=abc&via=scan"),
    "abc"
  );
});

test("parseWaveUrl: 裸路径（相对地址）", () => {
  assert.equal(parseWaveUrl("/?wave=w-abc&via=u-1"), "w-abc");
});

test("parseWaveUrl: wave 参数在中间", () => {
  assert.equal(parseWaveUrl("/?a=1&wave=mid&b=2#top"), "mid");
});

test("parseWaveUrl: 无 wave 参数 → null", () => {
  assert.equal(parseWaveUrl("https://oto.example/?via=u-1"), null);
  assert.equal(parseWaveUrl("随机文本不是链接"), null);
  assert.equal(parseWaveUrl(""), null);
  assert.equal(parseWaveUrl("   "), null);
});

test("parseWaveUrl: wave 为空 → null", () => {
  assert.equal(parseWaveUrl("/?wave="), null);
});

test("parseWaveUrl: wave 需 URL 编码时正确解码", () => {
  assert.equal(parseWaveUrl("/?wave=%20%20"), null);
  assert.equal(parseWaveUrl("/?wave=%77-1"), "w-1");
});