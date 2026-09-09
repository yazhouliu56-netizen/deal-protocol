import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { toast, updateToast, useToastStore } from "./toast.ts";

// 单文件单次 fake（跨测残留 timer 回调遇失踪 id 即 no-op，dismiss 语义保证无害）。
mock.timers.enable({ apis: ["setTimeout"] });

function reset() {
  useToastStore.getState().dismissAll();
}

test("push 返回 id 并默认 info", () => {
  reset();
  const id = toast("你好");
  const items = useToastStore.getState().items;
  assert.equal(items.length, 1);
  assert.equal(items[0].id, id);
  assert.equal(items[0].text, "你好");
  assert.equal(items[0].tone, "info");
});

test("同值三 tone 并存上限 3（slice(-2) 逐出最旧）", () => {
  reset();
  toast("一");
  toast("二");
  toast("三");
  toast("四");
  assert.deepEqual(
    useToastStore.getState().items.map((t) => t.text),
    ["二", "三", "四"],
  );
});

test("update 命中改写并重置 TTL（loading→终态）", () => {
  reset();
  const id = toast("同步中…", "info");
  mock.timers.tick(2000);
  const again = updateToast(id, "同步成功", "success");
  assert.equal(again, id);
  // 若无重置，此刻应已过期；重置后仍在且为 success
  mock.timers.tick(2000);
  const items = useToastStore.getState().items;
  assert.equal(items.length, 1);
  assert.equal(items[0].text, "同步成功");
  assert.equal(items[0].tone, "success");
});

test("update 遇失踪 id 即新建（终态必达）", () => {
  reset();
  mock.timers.tick(3000);
  assert.equal(useToastStore.getState().items.length, 0);
  const id = updateToast(999999, "后到也是到", "error");
  assert.equal(useToastStore.getState().items[0].id, id);
  assert.equal(useToastStore.getState().items[0].text, "后到也是到");
});

test("TTL 到自清 + dismiss/dismissAll", () => {
  reset();
  toast("甲");
  toast("乙");
  mock.timers.tick(2600);
  assert.equal(useToastStore.getState().items.length, 0);
  const id = toast("丙");
  useToastStore.getState().dismiss(id);
  assert.equal(useToastStore.getState().items.length, 0);
  toast("丁");
  useToastStore.getState().dismissAll();
  assert.equal(useToastStore.getState().items.length, 0);
});

test("action 透传（知晓按钮契约）", () => {
  reset();
  let hit = 0;
  toast("有新通知", "info", { label: "知晓", onClick: () => hit++ });
  assert.equal(useToastStore.getState().items[0].action?.label, "知晓");
  useToastStore.getState().items[0].action?.onClick();
  assert.equal(hit, 1);
});
