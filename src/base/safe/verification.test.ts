/**
 * 实名门禁纯核考卷（node:test）：四件分项＋FULL＋存量宽限矩阵。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkVerificationGate,
  isVerificationFull,
  verificationStageOf,
  VERIFICATION_GRACE_END_MS,
} from "./verification.ts";

const FULL = {
  verification_status: "approved",
  phone_verified_at: "2026-09-26T00:00:00+08:00",
  verification_id_number: "enc",
  face_verified_at: "2026-09-26T00:00:00+08:00",
  created_at: "2026-09-26T00:00:00+08:00",
};

test("四件分项：缺哪指哪", () => {
  assert.deepEqual(verificationStageOf({}), { phone: false, id: false, face: false, approved: false });
  assert.deepEqual(verificationStageOf(FULL), { phone: true, id: true, face: true, approved: true });
});

test("FULL：四件齐才真", () => {
  assert.equal(isVerificationFull(FULL), true);
  assert.equal(isVerificationFull({ ...FULL, face_verified_at: null }), false);
  assert.equal(isVerificationFull({ ...FULL, verification_status: "pending" }), false);
});

test("门禁：FULL 放行无宽限标记", () => {
  assert.deepEqual(checkVerificationGate(FULL, VERIFICATION_GRACE_END_MS + 1), {
    allowed: true,
    graced: false,
    missing: [],
  });
});

test("门禁：存量老号宽限内放行＋graced（缺件照报）", () => {
  const r = checkVerificationGate(
    { verification_status: "unverified", created_at: "2026-01-01T00:00:00+08:00" },
    VERIFICATION_GRACE_END_MS - 1000,
  );
  assert.equal(r.allowed, true);
  assert.equal(r.graced, true);
  assert.deepEqual(r.missing, ["phone", "id", "face", "approved"]);
});

test("门禁：宽限过期老号照拦；新号无宽限；created 缺席 fail-closed", () => {
  const old = { verification_status: "unverified", created_at: "2026-01-01T00:00:00+08:00" };
  assert.equal(checkVerificationGate(old, VERIFICATION_GRACE_END_MS + 1).allowed, false);
  assert.equal(
    checkVerificationGate({ verification_status: "unverified", created_at: "2026-09-27T00:00:00+08:00" }, Date.parse("2026-09-28T00:00:00+08:00")).graced,
    false,
  );
  assert.equal(checkVerificationGate({ verification_status: "unverified" }, Date.now()).allowed, false);
});
