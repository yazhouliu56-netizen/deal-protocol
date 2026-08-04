import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyBooking,
  applyCancel,
  bookingWorkerOrder,
  iconFor,
  type BookingInput,
} from "./booking.ts";

const booking: BookingInput = {
  id: "b1",
  title: "羽毛球双打 · 2 小时",
  time: "周六 15:00",
  price: "¥80",
  createdAt: 123,
};

test("iconFor maps category keywords with fallback", () => {
  assert.equal(iconFor(booking.title), "🏸");
  assert.equal(iconFor("日系写真 · 滨江"), "📷");
  assert.equal(iconFor("深度保洁 · 180㎡"), "🧹");
  assert.equal(iconFor("神秘团购"), "✨");
});

test("bookingWorkerOrder mirrors the booking onto the bench", () => {
  const o = bookingWorkerOrder(booking, "我（Alex）");
  assert.equal(o.id, booking.id);
  assert.equal(o.service, booking.title);
  assert.equal(o.status, "pending");
  assert.equal(o.icon, "🏸");
  assert.equal(o.client, "我（Alex）");
  assert.equal(o.providerId, "kail");
});

test("applyBooking prefills both slices without dupes", () => {
  let s = { bookings: [] as BookingInput[], workerOrders: [] };
  s = applyBooking(s, booking);
  assert.equal(s.bookings.length, 1);
  assert.equal(s.workerOrders.length, 1);

  s = applyBooking(s, booking);
  assert.equal(s.bookings.length, 2, "same booking allowed on user side");
  assert.equal(s.workerOrders.length, 1, "bench side must not duplicate");
});

test("applyCancel marks cancelled and removes the bench order", () => {
  let s = { bookings: [booking] as BookingInput[], workerOrders: [bookingWorkerOrder(booking)] };
  s = applyCancel(s, booking.id);
  assert.equal(s.bookings[0].status, "cancelled");
  assert.equal(s.workerOrders.length, 0);
});