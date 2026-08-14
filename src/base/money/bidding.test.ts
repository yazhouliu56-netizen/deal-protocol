import { test } from "node:test";
import assert from "node:assert/strict";
import {
  award,
  cancelBidding,
  commissionOf,
  openBidding,
  placeBid,
  rankBids,
  type Bid,
  type BiddingSession,
} from "./bidding.ts";

const bid = (id: string, name: string, price: number, note = "能接"): Bid => ({
  bidderId: id,
  bidderName: name,
  price,
  note,
  placedAt: "2026-08-09T08:00:00Z",
});

test("openBidding: fresh session is open with an empty board", () => {
  const s = openBidding("b1", "小区保洁", 60);
  assert.equal(s.status, "open");
  assert.equal(s.reserveYuan, 60);
  assert.equal(s.bids.length, 0);
});

test("placeBid: below reserve is rejected", () => {
  const s = openBidding("b2", "保洁", 60);
  const r = placeBid(s, bid("u1", "阿明", 50, "低价"));
  if (r.ok) assert.fail("below-reserve bid must be rejected");
  assert.equal(r.error, "below-reserve");
  assert.equal(s.bids.length, 0);
});

test("placeBid: valid bid lands on the board", () => {
  const s0 = openBidding("b3", "保洁", 60);
  const r = placeBid(s0, bid("u1", "阿明", 66));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.upserted, false);
    assert.equal(r.session.bids.length, 1);
  }
});

test("placeBid: re-bidding by the same person overwrites (no flood)", () => {
  let s = openBidding("b4", "保洁", 60);
  s = (placeBid(s, bid("u1", "阿明", 66)) as { session: BiddingSession }).session;
  const r = placeBid(s, bid("u1", "阿明", 61));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.upserted, true);
    assert.equal(r.session.bids.length, 1);
    assert.equal(r.session.bids[0].price, 61);
  }
});

test("placeBid: closed session rejects any bid", () => {
  let s = openBidding("b5", "保洁", 60);
  s = (placeBid(s, bid("u1", "阿明", 66)) as { session: BiddingSession }).session;
  s = award(s);
  assert.equal(s.status, "awarded");
  const r = placeBid(s, bid("u9", "路人", 99));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "closed");
});

test("rankBids: lowest first, same price �?earliest first", () => {
  let s = openBidding("b6", "保洁", 60);
  const high = { ...bid("u2", "小李", 72), placedAt: "2026-08-09T08:10:00Z" };
  const earlyLow = { ...bid("u1", "阿明", 66), placedAt: "2026-08-09T08:01:00Z" };
  const lateLow = { ...bid("u3", "王姐", 66), placedAt: "2026-08-09T08:05:00Z" };
  s = (placeBid(s, high) as { session: BiddingSession }).session;
  s = (placeBid(s, earlyLow) as { session: BiddingSession }).session;
  s = (placeBid(s, lateLow) as { session: BiddingSession }).session;
  const ranked = rankBids(s);
  assert.deepEqual(
    ranked.map((b) => b.bidderId),
    ["u1", "u3", "u2"]
  );
});

test("commissionOf: rate with floor", () => {
  assert.equal(commissionOf(100), 8);
  assert.equal(commissionOf(20), 2);
  assert.equal(commissionOf(8), 2);
});

test("award: lowest bid wins, net = price - fee", () => {
  let s = openBidding("b7", "保洁", 60);
  s = (placeBid(s, bid("u1", "阿明", 88)) as { session: BiddingSession }).session;
  s = (placeBid(s, bid("u2", "小李", 72)) as { session: BiddingSession }).session;
  s = award(s);
  assert.equal(s.status, "awarded");
  assert.deepEqual(s.award, {
    winnerId: "u2",
    winnerName: "小李",
    price: 72,
    feeYuan: 5.76,
    netYuan: 66.24,
  });
});

test("award: empty board stays open (no phantom winner)", () => {
  const s = award(openBidding("b8", "保洁", 60));
  assert.equal(s.status, "open");
  assert.equal(s.award, undefined);
});

test("cancelBidding: closes without a winner, board preserved", () => {
  let s = openBidding("b9", "保洁", 60);
  s = (placeBid(s, bid("u1", "阿明", 66)) as { session: BiddingSession }).session;
  s = cancelBidding(s);
  assert.equal(s.status, "cancelled");
  assert.equal(s.bids.length, 1);
  const after = award(s);
  assert.equal(after.status, "cancelled");
  assert.equal(after.award, undefined);
});