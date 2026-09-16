/**
 * 提醒文案覆盖率考卷（P4 · 宪法 #4：文案跟弹药走）。
 * 锁：两类目 10 槽全覆盖，缺一条即红。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGE_REMINDER_SLOTS } from "../base/order/stage-reminders.ts";
import { STAGE_COPY_TABLES } from "./stage-copy.ts";

test("housekeeping / meetup 槽位文案全覆盖", () => {
  for (const [category, table] of Object.entries(STAGE_COPY_TABLES)) {
    for (const slot of STAGE_REMINDER_SLOTS) {
      const copy = table[slot.copyKey];
      assert.ok(
        typeof copy === "string" && copy.trim().length > 0,
        `${category} 缺文案：${slot.copyKey}`,
      );
    }
  }
});
