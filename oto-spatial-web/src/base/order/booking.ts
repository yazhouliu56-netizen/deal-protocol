/**
 * Pure helpers for the double-view booking closure (user bookings ↔ worker
 * bench orders). Kept free of zustand/@-alias so they run in node tests.
 */

export interface BookingInput {
  id: string;
  title: string;
  time: string;
  price: string;
  createdAt: number;
}

export interface WorkerOrderInput {
  id: string;
  service: string;
  icon: string;
  client: string;
  time: string;
  price: string;
  status: "pending" | "active" | "completed";
  createdAt: number;
  providerId?: string;
}

const ICON_RULES: Array<[RegExp, string]> = [
  [/羽毛球/, "🏸"],
  [/摄影|约拍|写真/, "📷"],
  [/保洁/, "🧹"],
];

export function iconFor(title: string): string {
  for (const [re, icon] of ICON_RULES) {
    if (re.test(title)) return icon;
  }
  return "✨";
}

/**
 * Derive the worker-bench order from a user booking (a booking is the demand
 * side; the same record lands on the provider bench as a pending order).
 */
export function bookingWorkerOrder(
  booking: BookingInput,
  client = "我（Alex）"
): WorkerOrderInput {
  return {
    id: booking.id,
    service: booking.title,
    icon: iconFor(booking.title),
    client,
    time: booking.time,
    price: booking.price,
    status: "pending",
    createdAt: booking.createdAt,
    providerId: "kail",
  };
}

/** Apply a new booking to both slices; the bench side never duplicates. */
export function applyBooking<S extends BookingInput>(
  state: { bookings: S[]; workerOrders: WorkerOrderInput[] },
  booking: S
): { bookings: S[]; workerOrders: WorkerOrderInput[] } {
  const already = state.workerOrders.some((o) => o.id === booking.id);
  return {
    bookings: [booking, ...state.bookings],
    workerOrders: already ? state.workerOrders : [bookingWorkerOrder(booking), ...state.workerOrders],
  };
}

/** Cancel a booking: mark user-side cancelled and drop the bench order. */
export function applyCancel<S extends BookingInput>(
  state: { bookings: S[]; workerOrders: WorkerOrderInput[] },
  id: string
): { bookings: (S & { status?: "cancelled" })[]; workerOrders: WorkerOrderInput[] } {
  return {
    bookings: state.bookings.map((b) =>
      b.id === id ? { ...b, status: "cancelled" as const } : b
    ),
    workerOrders: state.workerOrders.filter((o) => o.id !== id),
  };
}