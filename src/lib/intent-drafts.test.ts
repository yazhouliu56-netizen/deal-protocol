import { describe, expect, it } from "vitest";

import { buildIntentDraftRecord } from "./intent-drafts";
import { emptyDraft } from "@/base/order/publish-draft";

describe("intent-drafts", () => {
  it("纯构造：快照隔离＋幂等键", () => {
    const d = { ...emptyDraft(), category: "保洁" };
    const rec = buildIntentDraftRecord(d, "trace-1", 1000);
    expect(rec.traceId).toBe("trace-1");
    expect(rec.savedAt).toBe(1000);
    d.category = "改了";
    expect(rec.draft.category).toBe("保洁");
  });
});
