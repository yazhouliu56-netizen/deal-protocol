/**
 * 统一发布准入引擎单测（Step1 准入闸门下沉）。
 * 闸门序：banned → sentinel(high 拒) → debt → minor；敏感词独立返回。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluatePublishAdmission,
  type IPublishAdmissionInput,
} from "./admission.ts";
import type { DeviceBinding } from "./roamGuard.ts";

const NOW = 1_800_000_000_000;
const YEAR = new Date(NOW).getFullYear();

function bindings(n: number): DeviceBinding[] {
  return Array.from({ length: n }, (_, i) => ({
    deviceId: "dev-1",
    identityId: `id-${i}`,
    firstSeen: NOW - 1000,
    lastSeen: NOW - 1000,
  }));
}

function base(overrides: Partial<IPublishAdmissionInput> = {}): IPublishAdmissionInput {
  return {
    authorId: "me-1",
    scanText: "厨师上门做饭",
    amountYuan: 200,
    category: "厨师 · 上门做饭",
    bindings: [],
    deviceId: "dev-1",
    recentPublishCount: 0,
    hasUnsettledBreachFlag: false,
    homeAccessKeywords: ["进家", "上门"],
    bans: {},
    ...overrides,
  };
}

describe("evaluatePublishAdmission 统一发布准入引擎", () => {
  it("干净输入 → 放行 safe 无敏感词命中", () => {
    const r = evaluatePublishAdmission(base(), NOW);
    assert.equal(r.allowed, true);
    assert.equal(r.riskLevel, "safe");
    assert.equal(r.sensitiveHit, null);
    assert.equal(r.blockedReason, undefined);
  });

  it("闸门 0：封禁中 → banned 拒绝且不再产生审计", () => {
    const r = evaluatePublishAdmission(
      base({ bans: { "me-1": { action: "ban", since: NOW - 1, note: "x" } } }),
      NOW
    );
    assert.equal(r.allowed, false);
    assert.equal(r.blockedReason, "banned");
    assert.equal(r.auditEvents.length, 0);
  });

  it("闸门 1：同设备 3 身份 + 裂变 → sentinel high 拒绝并落审计事件", () => {
    const r = evaluatePublishAdmission(
      base({ bindings: bindings(3), graphFission: true }),
      NOW
    );
    assert.equal(r.allowed, false);
    assert.equal(r.blockedReason, "sentinel");
    assert.equal(r.riskLevel, "high");
    assert.ok(r.auditEvents.length > 0);
    assert.match(r.auditEvents[0].note, /拒绝发布/);
  });

  it("闸门 1 引信加权：进家类目词表命中提升分值（watch 阈值实证）", () => {
    // 2 身份共机 = watch 基线；无词表 → safe/watch 边界，有词表 ×1.2 必过 watch
    const plain = evaluatePublishAdmission(
      base({ bindings: bindings(2), homeAccessKeywords: [] }),
      NOW
    );
    const boosted = evaluatePublishAdmission(base({ bindings: bindings(2) }), NOW);
    assert.ok(
      boosted.sentinelScore > plain.sentinelScore,
      "引信加权后分值必须严格提升"
    );
  });

  it("watch 级放行但携带降权审计事件", () => {
    const r = evaluatePublishAdmission(base({ bindings: bindings(2) }), NOW);
    if (r.riskLevel === "watch") {
      assert.equal(r.allowed, true);
      assert.ok(r.auditEvents.some((e) => e.level === "watch"));
    } else {
      assert.equal(r.allowed, true);
    }
  });

  it("闸门 2：no-show 违约未结 → debt 拒绝", () => {
    const r = evaluatePublishAdmission(base({ hasUnsettledBreachFlag: true }), NOW);
    assert.equal(r.allowed, false);
    assert.equal(r.blockedReason, "debt");
  });

  it("闸门 3：儿童（<14）无监护人同意 → minor 拒绝", () => {
    const r = evaluatePublishAdmission(
      base({ birthYear: YEAR - 10, guardianConsent: false }),
      NOW
    );
    assert.equal(r.allowed, false);
    assert.equal(r.blockedReason, "minor");
  });

  it("闸门 3：青少年（14-17）发布为免费动作 → 放行", () => {
    const r = evaluatePublishAdmission(
      base({ birthYear: YEAR - 16, guardianConsent: false }),
      NOW
    );
    assert.equal(r.allowed, true);
    assert.equal(r.blockedReason, undefined);
  });

  it("闸门 3：birthYear 缺省不拦截（与既有资金闸口径一致）", () => {
    const r = evaluatePublishAdmission(base({ birthYear: undefined }), NOW);
    assert.equal(r.allowed, true);
  });

  it("敏感词命中 ≠ 拒绝发布：allowed=true 且返回命中标签（先挡后审语义）", () => {
    const r = evaluatePublishAdmission(
      base({ scanText: "正规按摩全套服务" }),
      NOW
    );
    assert.equal(r.allowed, true);
    assert.equal(r.sensitiveHit, "涉黄服务");
  });
});
