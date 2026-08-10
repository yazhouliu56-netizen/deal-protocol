import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clipMeta,
  queryClips,
  summarizeEvidence,
  type VoiceClip,
} from "./audioStore.ts";

const clip = (over: Partial<VoiceClip> = {}): VoiceClip => ({
  id: "id-" + Math.random().toString(36).slice(2, 8),
  side: "user",
  text: "想约下午打羽毛球",
  ts: 1000,
  ...over,
});

test("clipMeta: 生成稳定元数据（id/ts/关联字段）", () => {
  const c = clipMeta({
    side: "user",
    text: "下午三点羽毛球",
    ts: 1700000000000,
    msgId: "m1",
    waveId: "w1",
    durationMs: 3200,
  });
  assert.ok(c.id.length > 0);
  assert.equal(c.side, "user");
  assert.equal(c.msgId, "m1");
  assert.equal(c.waveId, "w1");
  assert.equal(c.durationMs, 3200);
  assert.equal(c.blob, undefined);
});

test("queryClips: 按 waveId 过滤 + 时间升序", () => {
  const clips = [
    clip({ id: "a", waveId: "w1", ts: 200 }),
    clip({ id: "b", waveId: "w2", ts: 100 }),
    clip({ id: "c", waveId: "w1", ts: 50 }),
  ];
  const out = queryClips(clips, { waveId: "w1" });
  assert.deepEqual(
    out.map((c) => c.id),
    ["c", "a"]
  );
});

test("queryClips: 按 msgId + side 过滤", () => {
  const clips = [
    clip({ id: "a", msgId: "m1", side: "user" }),
    clip({ id: "b", msgId: "m1", side: "assistant" }),
    clip({ id: "c", msgId: "m2", side: "user" }),
  ];
  assert.deepEqual(queryClips(clips, { msgId: "m1", side: "user" }).map((c) => c.id), ["a"]);
});

test("queryClips: 空输入 → 空结果", () => {
  assert.deepEqual(queryClips([], { waveId: "w1" }), []);
});

test("summarizeEvidence: 生成可贴凭证区的摘要（含时间/角色/截断）", () => {
  const long = "我".repeat(100);
  const out = summarizeEvidence([
    clip({ side: "user", text: "约下午羽毛球", ts: 1000 }),
    clip({ side: "assistant", text: long, ts: 2000 }),
  ]);
  assert.match(out, /语音凭证（2 条）/);
  assert.match(out, /需求方语音：约下午羽毛球/);
  assert.match(out, /平台播报：我{80}…/);
  assert.ok(out.indexOf("需求方语音") < out.indexOf("平台播报"));
});

test("summarizeEvidence: 无留证 → 空串", () => {
  assert.equal(summarizeEvidence([]), "");
});