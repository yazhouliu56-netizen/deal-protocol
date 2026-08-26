/**
 * Microkernel 2.0 战役 1（P0-1）· 资金模式能力矩阵考卷：
 * 白名单=真实枚举三模式 / 未支持模式 Fail-Fast 拦截 / 膛线分派路由 /
 * 纯度（无 IO 依赖，纯入参策略）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_FUNDING_MODES,
  UNSUPPORTED_FUNDING_MODE,
  dispatchFundingOperation,
  fundingBreechOf,
  validateFundingModeSupport,
} from "./funding-dispatcher.ts";
import { calculateEscrowHold, calculateTieredRefund, calculateProviderSettlement } from "./escrow.ts";
import { createMilestonePlan, evaluateMilestoneTimeout, releaseMilestone } from "./milestone-escrow.ts";

test("白名单 = 三条真实膛线（full_prepay/commitment/milestone_staged），DIRECT_PAY 不在列", () => {
  assert.deepEqual([...SUPPORTED_FUNDING_MODES], ["full_prepay", "commitment", "milestone_staged"]);
});

test("validateFundingModeSupport：白名单内通过（null），纸面协议模式定位拒绝", () => {
  for (const m of SUPPORTED_FUNDING_MODES) {
    assert.equal(validateFundingModeSupport(m), null);
  }
  for (const paper of ["streaming", "crowdfunding", "money_pool", "vesting_cliff", "FULL_ESCROW"]) {
    const err = validateFundingModeSupport(paper);
    assert.match(err ?? "", new RegExp(`^${UNSUPPORTED_FUNDING_MODE}`));
    assert.match(err ?? "", new RegExp(paper));
  }
});

test("dispatchFundingOperation：通用膛线路由（full_prepay 与 commitment 同膛线）", () => {
  assert.equal(dispatchFundingOperation("full_prepay", "hold"), calculateEscrowHold);
  assert.equal(dispatchFundingOperation("commitment", "hold"), calculateEscrowHold);
  assert.equal(dispatchFundingOperation("commitment", "refund"), calculateTieredRefund);
  assert.equal(dispatchFundingOperation("full_prepay", "settle"), calculateProviderSettlement);
});

test("dispatchFundingOperation：分期膛线路由（milestone_staged 原语级）", () => {
  assert.equal(dispatchFundingOperation("milestone_staged", "plan"), createMilestonePlan);
  assert.equal(dispatchFundingOperation("milestone_staged", "release"), releaseMilestone);
  assert.equal(dispatchFundingOperation("milestone_staged", "timeout_check"), evaluateMilestoneTimeout);
});

test("交叉膛线与未支持模式：Fail-Fast 抛错且错误码可定位", () => {
  assert.throws(
    () => dispatchFundingOperation("streaming", "hold"),
    new RegExp(UNSUPPORTED_FUNDING_MODE),
  );
  assert.throws(() => dispatchFundingOperation("full_prepay", "plan" as never), /FUNDING_OP_NOT_IN_BREECH/);
  assert.throws(() => dispatchFundingOperation("milestone_staged", "refund" as never), /FUNDING_OP_NOT_IN_BREECH/);
});

test("膛线归属台账：分期独立、预付/承诺归通用", () => {
  assert.equal(fundingBreechOf("milestone_staged"), "milestone_escrow");
  assert.equal(fundingBreechOf("full_prepay"), "generic_escrow");
  assert.equal(fundingBreechOf("commitment"), "generic_escrow");
});
