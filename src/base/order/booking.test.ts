import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_ICON_RULES } from "../../ammo/scene-template.ts";
import {
  applyBooking,
  applyCancel,
  bookingWorkerOrder,
  iconFor,
  type BookingInput,
  type WorkerOrderInput,
} from "./booking.ts";

type BookingRow = BookingInput & { status?: "cancelled" };

const booking: BookingInput = {
  id: "b1",
  title: "羽毛球双打 · 2 小时",
  time: "周六 15:00",
  price: "¥80",
  createdAt: 123,
};

test("iconFor maps category keywords with fallback（词表由弹药注入）", () => {
  assert.equal(iconFor(booking.title, CATEGORY_ICON_RULES), "🏸");
  assert.equal(iconFor("日系写真 · 滨江", CATEGORY_ICON_RULES), "📷");
  assert.equal(iconFor("深度保洁 · 180㎡", CATEGORY_ICON_RULES), "🧹");
  assert.equal(iconFor("神秘团购", CATEGORY_ICON_RULES), "✨");
  assert.equal(iconFor(booking.title), "✨", "未装填弹药 → 通用兜底");
});

test("bookingWorkerOrder mirrors the booking onto the bench", () => {
  const o = bookingWorkerOrder(booking, "我（Alex）", CATEGORY_ICON_RULES);
  assert.equal(o.id, booking.id);
  assert.equal(o.service, booking.title);
  assert.equal(o.status, "pending");
  assert.equal(o.icon, "🏸");
  assert.equal(o.client, "我（Alex）");
  assert.equal(o.providerId, "kail");
});

test("applyBooking prefills both slices without dupes", () => {
  let s: { bookings: BookingInput[]; workerOrders: WorkerOrderInput[] } = {
    bookings: [],
    workerOrders: [],
  };
  s = applyBooking(s, booking, CATEGORY_ICON_RULES);
  assert.equal(s.bookings.length, 1);
  assert.equal(s.workerOrders.length, 1);
  assert.equal(s.workerOrders[0].icon, "🏸");

  s = applyBooking(s, booking, CATEGORY_ICON_RULES);
  assert.equal(s.bookings.length, 2, "same booking allowed on user side");
  assert.equal(s.workerOrders.length, 1, "bench side must not duplicate");
});

test("applyCancel marks cancelled and removes the bench order", () => {
  let s: { bookings: BookingRow[]; workerOrders: WorkerOrderInput[] } = {
    bookings: [booking],
    workerOrders: [bookingWorkerOrder(booking, "我（Alex）", CATEGORY_ICON_RULES)],
  };
  s = applyCancel(s, booking.id);
  assert.equal(s.bookings[0].status, "cancelled");
  assert.equal(s.workerOrders.length, 0);
});