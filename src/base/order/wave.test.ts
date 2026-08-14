import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activateWave,
  assembleWave,
  breachClaim,
  claimDirect,
  closeWave,
  counterOffer,
  createWave,
  isOpenMatch,
  isWaveExpired,
  joinSeat,
  lockNegotiation,
  neededJoiners,
  nextSpeaker,
  openNegotiation,
  perSeatPrice,
  resolveNoShow,
  requestSeat,
  approveRequest,
  rejectRequest,
  withdrawClaim,
  joinWaitlist,
  leaveWaitlist,
  promoteFromWaitlist,
  MAX_ROUNDS,
  type Wave,
} from "./wave.ts";

const now = 1_700_000_000_000;

function baseWave(overrides?: Partial<Parameters<typeof createWave>[0]>): Wave {
  return createWave({
    id: "w1",
    authorId: "me",
    basics: {
      category: "厨师 · 上门做饭",
      time: "明天 11:00",
      area: "幸福家园小区",
      radiusKm: 5,
    },
    budget: 100,
    customs: [{ text: "30 岁左右女性", tags: ["女性"] }],
    expiresAt: now + 3600_000,
    createdAt: now,
    ...overrides,
  });
}

test("createWave validates basic essentials and budget", () => {
  assert.throws(() =>
    createWave({
      id: "x",
      authorId: "me",
      basics: { category: "  ", time: "11:00", area: "幸福家园", radiusKm: 3 },
      budget: 100,
      expiresAt: now + 1000,
      createdAt: now,
    })
  );
  assert.throws(() => baseWave({ budget: 0 }));
});

test("claimDirect locks the wave to the first responder (甲)", () => {
  const wave = baseWave();
  const { wave: locked, claim } = claimDirect(wave, "r1", "c1", 120, now);
  assert.equal(locked.status, "claimed");
  assert.equal(locked.claimedById, "r1");
  assert.equal(claim.status, "accepted");
  assert.equal(claim.rounds, 0);
});

test("claimDirect refuses when wave is not active", () => {
  const wave = closeWave(baseWave());
  assert.throws(() => claimDirect(wave, "r1", "c1", 120, now));
});

test("openNegotiation requires a negotiable wave", () => {
  assert.throws(() => openNegotiation(baseWave(), "r1", "c1", 120, now));
  const wave = baseWave({ negotiable: true });
  const claim = openNegotiation(wave, "r1", "c1", 120, now);
  assert.equal(claim.status, "negotiating");
  assert.equal(claim.rounds, 1);
});

test("counterOffer allows exactly MAX_ROUNDS rounds per pair (丙)", () => {
  let claim = openNegotiation(baseWave({ negotiable: true }), "r1", "c1", 100, now);
  // rounds 1 already used by the open; push to the limit
  for (let i = 2; i <= MAX_ROUNDS; i++) {
    claim = counterOffer(claim, 100 + i * 10, `round ${i}`);
  }
  assert.equal(claim.rounds, MAX_ROUNDS);
  assert.throws(() => counterOffer(claim, 999, "too far"), /rounds-exhausted/);
});

test("lockNegotiation: demander acceptance claims the wave", () => {
  const wave = baseWave({ negotiable: true });
  const claim = openNegotiation(wave, "r1", "c1", 100, now);
  const out = lockNegotiation(wave, claim, true);
  assert.equal(out.wave?.status, "claimed");
  assert.equal(out.wave?.claimedById, "r1");
  const declined = lockNegotiation(wave, claim, false);
  assert.equal(declined.error, "demander-declined");
});

test("withdraw / breach move the claim out of the funnel", () => {
  const wave = baseWave({ negotiable: true });
  let claim = openNegotiation(wave, "r1", "c1", 100, now);
  claim = withdrawClaim(claim);
  assert.equal(claim.status, "withdrawn");
  claim = breachClaim(claim);
  assert.equal(claim.status, "breached");
});

test("isWaveExpired compares against expiresAt", () => {
  const wave = baseWave({ expiresAt: now + 1000 });
  assert.equal(isWaveExpired(wave, now + 2000), true);
  assert.equal(isWaveExpired(wave, now), false);
});

test("counterOffer enforces alternation (lastBy / same-side throws)", () => {
  const wave = baseWave({ negotiable: true });
  let claim = openNegotiation(wave, "r1", "c1", 100, now);
  assert.equal(claim.lastBy, "responder");
  assert.equal(nextSpeaker(claim), "demander");

  // demander counters → lastBy flips to demander
  claim = counterOffer(claim, 90, "太贵了", "demander");
  assert.equal(claim.lastBy, "demander");
  assert.equal(nextSpeaker(claim), "responder");

  // default actor = the other side → alternation holds automatically
  claim = counterOffer(claim, 95, "最低 95");
  assert.equal(claim.lastBy, "responder");

  // responder double-move → same-side rejected (checked before budget)
  assert.throws(
    () => counterOffer(claim, 88, "再少点", "responder"),
    /claim\.same-side/
  );
  // legal side but budget exhausted (3 rounds used) → locked
  assert.throws(
    () => counterOffer(claim, 85, "还不行吗", "demander"),
    /claim\.rounds-exhausted/
  );
});

/* ------------------------- 开放局 / 拼位 ------------------------- */

test("open match: capacity ≥ 2, per-seat price = budget ÷ capacity", () => {
  const wave = baseWave({ capacity: 4, budget: 200 });
  assert.equal(isOpenMatch(wave), true);
  assert.equal(isOpenMatch(baseWave()), false);
  assert.equal(neededJoiners(wave), 3);
  assert.equal(perSeatPrice(wave), 50);
  // 发单人自己算一个位：预算 100 / 2 人局 → 人均 50
  const duo = baseWave({ capacity: 2, budget: 100 });
  assert.equal(perSeatPrice(duo), 50);
});

test("joinSeat reserves a seat without locking the wave", () => {
  const wave = baseWave({ capacity: 4, budget: 200 });
  const first = joinSeat(wave, "r1", "c1", 0, now);
  assert.equal(first.claim.status, "joined");
  assert.equal(first.claim.price, 50);
  assert.equal(first.wave.status, "active", "未满员不锁局");
});

test("joinSeat fills the table → wave assembles (last seat)", () => {
  const wave = baseWave({ capacity: 3, budget: 150 });
  // 需求方自己 1 个位，需 2 位拼位者
  const first = joinSeat(wave, "r1", "c1", 0, now);
  const second = joinSeat(first.wave, "r2", "c2", 1, now);
  assert.equal(second.claim.status, "accepted", "最后一位直接 accepted");
  assert.equal(second.claim.depositPhase, undefined, "无鸽子险不冻结");
  assert.equal(second.wave.status, "assembled", "满员成局");
});

test("joinSeat rejects: solo wave / full table / non-active wave", () => {
  const solo = baseWave();
  assert.throws(() => joinSeat(solo, "r1", "c1", 0, now), /not-open-match/);
  const wave = baseWave({ capacity: 2, budget: 100 });
  // 满员（需求方 1 位 + 拼位 1 位已满）
  const joined = joinSeat(wave, "r1", "c1", 0, now);
  assert.equal(joined.wave.status, "assembled");
  assert.throws(() => joinSeat(joined.wave, "r2", "c2", 1, now), /assembled/);
  const closed = closeWave(wave);
  assert.throws(() => joinSeat(closed, "r2", "c2", 0, now), /not-active/);
});

test("claimDirect refuses open-match waves (拼位专用)", () => {
  const wave = baseWave({ capacity: 4 });
  assert.throws(() => claimDirect(wave, "r1", "c1", 120, now), /open-match-use-join/);
});

test("joinSeat with 鸽子险 holds deposit on the filling seat", () => {
  const wave = baseWave({ capacity: 2, budget: 100, deposit: true });
  const out = joinSeat(wave, "r1", "c1", 0, now);
  assert.equal(out.claim.status, "accepted");
  assert.equal(out.claim.depositPhase, "held", "满员成局即冻结押金");
});

test("assembleWave locks early when ≥1 seat taken", () => {
  const wave = baseWave({ capacity: 4, budget: 200, deposit: true });
  const seat = joinSeat(wave, "r1", "c1", 0, now);
  const out = assembleWave(seat.wave, [seat.claim]);
  assert.equal(out.wave.status, "assembled");
  assert.equal(out.claims[0].status, "accepted");
  assert.equal(out.claims[0].depositPhase, "held", "成局即冻结");
});

test("assembleWave refuses: no seats / not open match / not active", () => {
  const wave = baseWave({ capacity: 4, budget: 200 });
  assert.throws(() => assembleWave(wave, []), /no-seats/);
  assert.throws(() => assembleWave(baseWave(), []), /not-open-match/);
  const closed = closeWave(wave);
  assert.throws(() => assembleWave(closed, []), /not-active/);
});
test("�浥֧����pending �����������Ӧ��activateWave ��� active", () => {
  const pendingWave = baseWave({ pending: true });
  assert.equal(pendingWave.status, "pending");
  assert.throws(() => claimDirect(pendingWave, "r1", "c1"), /not-active/);
  const live = activateWave(pendingWave);
  assert.equal(live.status, "active");
  assert.throws(() => activateWave(baseWave()), /not-pending/);
});

test("startsAt �ṹ����ʼʱ������ wave �ϣ�24h ����ȡ���Ļ�����", () => {
  const w = baseWave({ startsAt: now + 24 * 3600_000 });
  assert.equal(w.startsAt, now + 24 * 3600_000);
  assert.equal(baseWave().startsAt, undefined);
});

test("resolveNoShow: no-show ��� �� ��̯�����ڳ���� + ������ buff", () => {
  const wave: Wave = { ...baseWave({ capacity: 3, budget: 300 }), status: "assembled" };
  const mk = (id: string) => ({
    id, waveId: wave.id, responderId: id, status: "accepted" as const,
    rounds: 0, price: 100, createdAt: now,
  });
  const claimA = mk("rA");   // no-show ��λ
  const claimB = mk("rB");   // �ڳ�
  const claimC = mk("rC");   // �ڳ�
  const out = resolveNoShow({
    wave,
    claim: claimA,
    attendees: [claimA, claimB, claimC],
    paidAmount: 100,
  });
  assert.equal(out.breachClaim.status, "breached");
  assert.equal(out.compensations["rB"], 50); // floor(100/2)
  assert.equal(out.compensations["rC"], 50);
  assert.equal(out.initiatorBuff, 1);       // �´� neededJoiners -1
});

test("resolveNoShow �ܾ�δ�ɾ� / �� accepted ��λ", () => {
  const wave = baseWave({ capacity: 3, budget: 300 });
  const mk = (id: string) => ({
    id, waveId: wave.id, responderId: id, status: "joined" as const,
    rounds: 0, price: 100, createdAt: now,
  });
  const claimA = mk("rA");
  assert.throws(() => resolveNoShow({ wave, claim: claimA, attendees: [], paidAmount: 100 }), /not-assembled/);
});

// --- Request to spot（组织者把关层，对标 Meetup 成员审批） ---

test("requestSeat: 开启审批制的开放局可提交申请，未开启拒绝", () => {
  const plain = baseWave({ capacity: 3 });
  assert.throws(() => requestSeat(plain, "r1", now), /approval-off/);
  const open = baseWave({ capacity: 3, needApproval: true });
  const out = requestSeat(open, "r1", now);
  assert.equal(out.wave.joinRequests?.length, 1);
});

test("requestSeat 同人重复申请不叠加", () => {
  const open = baseWave({ capacity: 3, needApproval: true });
  const r1 = requestSeat(open, "r1", now);
  const r2 = requestSeat(r1.wave, "r1", now + 100);
  assert.equal(r2.wave.joinRequests?.length, 1);
  assert.equal(r2.wave.joinRequests?.[0].responderId, "r1");
});

test("approveRequest: 审批通过 → 占座（满员即成局），并清掉该申请", () => {
  const open = baseWave({ capacity: 2, needApproval: true });
  const req = requestSeat(open, "r1", now);
  const out = approveRequest(req.wave, "r1", "c1", 0, now);
  assert.equal(out.error, undefined);
  assert.ok(out.claim);
  assert.equal(out.claim.status, "accepted"); // 2 人局，发起人 + r1 = 满员
  assert.equal(out.wave.status, "assembled");
  assert.equal(out.wave.joinRequests?.length, 0);
});

test("approveRequest: 未申请者/未开启审批拒绝", () => {
  const open = baseWave({ capacity: 3, needApproval: true });
  assert.equal(approveRequest(open, "ghost", "c9", 0, now).error, "wave.no-request");
  const plain = baseWave({ capacity: 3 });
  assert.equal(approveRequest(plain, "r1", "c1", 0, now).error, "wave.approval-off");
});

test("approveRequest: 座位满时审批返回 wave.full 并清申请", () => {
  const open = baseWave({ capacity: 2, needApproval: true });
  const req = requestSeat(open, "r1", now);
  // 发起人自己先占一席（capacity 2 → 剩 1 席）
  const first = joinSeat(req.wave, "initiator-join", "c0", 0, now);
  // r1 的申请此时只剩 0 席 → 满
  const out = approveRequest(first.wave, "r1", "c1", 1, now);
  assert.equal(out.error, "wave.full");
  assert.equal(out.wave.joinRequests?.length, 0);
});

test("rejectRequest: 拒绝仅移除申请，无占座副作用", () => {
  const open = baseWave({ capacity: 3, needApproval: true });
  const req = requestSeat(open, "r1", now);
  const out = rejectRequest(req.wave, "r1");
  assert.equal(out.wave.joinRequests?.length, 0);
  assert.equal(out.wave.status, "active");
});

/* ---------- 候补（waitlist，Meetup 吸收项 ②） ---------- */

test("joinWaitlist: 满员开放局支持入队，幂等不重复", () => {
  const wave = baseWave({ capacity: 2, budget: 100 });
  const once = joinWaitlist(wave, "r1", now);
  assert.equal(once.wave.waitlist?.length, 1);
  assert.equal(once.wave.waitlist?.[0].responderId, "r1");
  const twice = joinWaitlist(once.wave, "r1", now + 1000);
  assert.equal(twice.wave.waitlist?.length, 1, "同人重复入队不叠加");
  const another = joinWaitlist(once.wave, "r2", now + 2000);
  assert.equal(another.wave.waitlist?.length, 2, "不同人按序追加");
});

test("joinWaitlist 拒绝：单人局 / 非活跃局", () => {
  assert.throws(() => joinWaitlist(baseWave(), "r1", now), /not-open-match/);
  const closed = closeWave(baseWave({ capacity: 2 }));
  assert.throws(() => joinWaitlist(closed, "r1", now), /not-active/);
});

test("leaveWaitlist: 主动退出候补（幂等）", () => {
  const wave = baseWave({ capacity: 2, budget: 100 });
  const queued = joinWaitlist(joinWaitlist(wave, "r1", now).wave, "r2", now + 1).wave;
  assert.equal(queued.waitlist?.length, 2);
  const left = leaveWaitlist(queued, "r1");
  assert.equal(left.wave.waitlist?.length, 1);
  assert.equal(left.wave.waitlist?.[0].responderId, "r2", "剩余队列保持顺序");
  const again = leaveWaitlist(left.wave, "r1");
  assert.equal(again.wave.waitlist?.length, 1, "重复退出幂等");
});

test("promoteFromWaitlist: 无候补 → 原样返回", () => {
  const wave = baseWave({ capacity: 2, budget: 100 });
  const out = promoteFromWaitlist(wave, "c1", now);
  assert.equal(out.claim, undefined);
  assert.equal(out.wave, wave);
});

test("promoteFromWaitlist: FIFO 补位 → 首位升格 joined claim + 队列移除", () => {
  const wave = baseWave({ capacity: 2, budget: 100 });
  const queued = joinWaitlist(joinWaitlist(wave, "r1", now).wave, "r2", now + 1).wave;
  const out = promoteFromWaitlist(queued, "c9", now + 100);
  assert.equal(out.claim?.responderId, "r1", "按加入顺序补位");
  assert.equal(out.claim?.status, "joined", "占座 not 成局");
  assert.equal(out.claim?.price, 50, "人均价与 joinSeat 一致");
  assert.equal(out.claim?.createdAt, now + 100);
  assert.equal(out.wave.waitlist?.length, 1, "r1 移出队列");
  assert.equal(out.wave.waitlist?.[0].responderId, "r2", "r2 递补首位");
});

test("promoteFromWaitlist: 同一时刻入队按信用分降序补位", () => {
  const wave = baseWave({ capacity: 2, budget: 100 });
  const queued = joinWaitlist(joinWaitlist(wave, "low", now).wave, "high", now).wave;
  const out = promoteFromWaitlist(queued, "c9", now + 5, (id) =>
    id === "high" ? 1000 : 200
  );
  assert.equal(out.claim?.responderId, "high", "同 at 信用分高者优先");
});

test("promoteFromWaitlist: 与鸽子险联动 —— 补位 claim 持有押金", () => {
  const wave = baseWave({ capacity: 2, budget: 100, deposit: true });
  const queued = joinWaitlist(wave, "r1", now).wave;
  const out = promoteFromWaitlist(queued, "c9", now + 100);
  assert.equal(out.claim?.depositPhase, "held");
});

test("promoteFromWaitlist: acceptDirect 成局让位 → 补位者直接 accepted（局保持 assembled）", () => {
  const wave = baseWave({ capacity: 2, budget: 100 });
  const assembled = { ...wave, status: "assembled" as const };
  const queued = joinWaitlist(assembled, "r1", now).wave;
  const out = promoteFromWaitlist(queued, "c9", now + 100, undefined, true);
  assert.equal(out.claim?.status, "accepted", "成局让位 → 直接转正锁定席位");
  assert.equal(out.wave.status, "assembled", "局保持成局态");
  assert.equal(out.wave.waitlist, undefined, "队列耗尽即清空");
});

test("候补闭环：满员 → 入队 → 退出释放 → 首位补位 → 队列清空", () => {
  const wave = baseWave({ capacity: 3, budget: 150 });
  const first = joinSeat(wave, "r1", "c1", 0, now);
  // 发起人提前成局前的等待态：某人退出拼位（joined）→ 候补补位
  const queued = joinWaitlist(first.wave, "r2", now).wave;
  assert.equal(queued.waitlist?.length, 1);
  assert.equal(queued.status, "active");
  const out = promoteFromWaitlist(queued, "c9", now + 100);
  assert.equal(out.claim?.status, "joined");
  assert.equal(out.claim?.responderId, "r2");
  assert.equal(out.wave.waitlist, undefined, "补位后队列清空");
  // 队列为空后再补 → 原样返回
  const empty = promoteFromWaitlist(out.wave, "c9", now + 200);
  assert.equal(empty.claim, undefined);
});

