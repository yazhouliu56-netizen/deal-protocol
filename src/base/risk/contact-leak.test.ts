/**
 * P3.1-1 通信外漏识别引擎考卷（node:test，test:oto:units Glob 自动发现）。
 * 覆盖：合法放行 / 各类型命中 / 变体 / 防误杀白名单 / 边界容错。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectContactLeaks, maskContactLeaks } from "./contact-leak.ts";

test("合法正常对话 100% 放行（无命中无改写）", () => {
  const r = detectContactLeaks("明天上午 10 点到小区南门，工具自带，费用面议后定");
  assert.equal(r.hasLeak, false);
  assert.equal(r.maskedText, r.originalText);
  assert.deepEqual(r.leakTypes, []);
});

test("标准 11 位手机号命中并部分遮蔽", () => {
  const r = detectContactLeaks("联系我 13812345678");
  assert.equal(r.hasLeak, true);
  assert.deepEqual(r.leakTypes, ["PHONE"]);
  assert.equal(r.maskedText, "联系我 138****5678");
});

test("手机号空格/短横线分隔变体均命中", () => {
  for (const t of ["打 138 1234 5678", "打138-1234-5678啊"]) {
    const r = detectContactLeaks(t);
    assert.equal(r.hasLeak, true, t);
    assert.deepEqual(r.leakTypes, ["PHONE"], t);
    assert.match(r.maskedText, /138\*\*\*\*5678/);
  }
});

test("微信号 wx/vx 前缀 + ID 命中", () => {
  for (const t of ["加 wx: abc_123", "vx号 zhang999888 聊", "微信：myid_001"]) {
    const r = detectContactLeaks(t);
    assert.equal(r.hasLeak, true, t);
    assert.ok(r.leakTypes.includes("WECHAT"), t);
    assert.match(r.maskedText, /\[微信号已脱敏\]/);
  }
});

test("谐音前缀 威信/薇信/加微 命中", () => {
  for (const t of ["威信 laowang666", "薇信: shop_8899", "加微 kaola2026 看"]) {
    const r = detectContactLeaks(t);
    assert.equal(r.hasLeak, true, t);
    assert.ok(r.leakTypes.includes("WECHAT"), t);
  }
});

test("QQ 号必须携带前缀：qq123456 命中", () => {
  const r = detectContactLeaks("加扣扣 23456789 谈");
  assert.equal(r.hasLeak, true);
  assert.ok(r.leakTypes.includes("QQ"));
  assert.match(r.maskedText, /\[QQ号已脱敏\]/);
});

test("裸 5~11 位数字串（无 QQ 前缀）一律放行", () => {
  const r = detectContactLeaks("订单号 23456789 已生成");
  assert.equal(r.hasLeak, false);
});

test("邮箱命中并遮蔽为 a***@domain 形态", () => {
  const r = detectContactLeaks("发到 alice.test@qq.com 就行");
  assert.equal(r.hasLeak, true);
  assert.deepEqual(r.leakTypes, ["EMAIL"]);
  assert.equal(r.maskedText, "发到 a***@qq.com 就行");
});

test("外部链接 http/www 命中并整体拦截", () => {
  for (const t of ["详情看 https://example.com/deal?a=1", "去 www.trade.cn 找我"]) {
    const r = detectContactLeaks(t);
    assert.equal(r.hasLeak, true, t);
    assert.ok(r.leakTypes.includes("URL"), t);
    assert.match(r.maskedText, /\[外部链接已拦截\]/);
  }
});

test("防误杀白名单：日期/金额/长编号 100% 放行", () => {
  const r = detectContactLeaks("2026-08-28 交货，100元 定金，单号 10000000001，房间 3-2-05");
  assert.equal(r.hasLeak, false);
  assert.equal(r.maskedText, r.originalText);
});

test("多类型混合命中：类型去重 + 全部脱敏", () => {
  const r = detectContactLeaks("手机 15912345678 或 qq 987654321，地址 https://t.cn/xyz");
  assert.equal(r.hasLeak, true);
  assert.deepEqual(r.leakTypes, ["URL", "PHONE", "QQ"]);
  assert.doesNotMatch(r.maskedText, /15912345678/);
  assert.doesNotMatch(r.maskedText, /987654321/);
  assert.doesNotMatch(r.maskedText, /https:\/\//);
});

test("空字符串与无泄漏等价：0ms 安全返回", () => {
  const r = detectContactLeaks("");
  assert.equal(r.hasLeak, false);
  assert.equal(r.maskedText, "");
});

test("畸形输入（非字符串）容错不抛异常（宪法 #10）", () => {
  const r = detectContactLeaks(undefined as unknown as string);
  assert.equal(r.hasLeak, false);
  assert.equal(r.maskedText, "");
});

test("maskContactLeaks 便捷入口返回纯脱敏文本", () => {
  assert.equal(maskContactLeaks("电 13812345678"), "电 138****5678");
  assert.equal(maskContactLeaks("正常文本"), "正常文本");
});
