# Remaining Architecture Audit

Generated: 2026-07-25 | Scope: `src/` full cross-coverage scan

---

## Overview

Four blind-spot domains were scanned with full cross-referencing:

| Domain | Coverage | Health Score |
|--------|----------|-------------|
| 1. API Rate Limiting & Anti-Spam | 11 routes + 4 modules | **35/100** |
| 2. Offline Push & Notification Reliability | 15 producers + 4 consumer paths | **40/100** |
| 3. Team Formation & Group Payout Closing | 2 modules + 1 integration chain | **25/100** |
| 4. Data Lifecycle, Cascade & Privacy | 27 migrations + 140+ evidence refs | **50/100** |

**Overall System Health: 38/100** — Critical structural gaps exist in every domain.

---

## 1. API Rate Limiting & Anti-Spam

### Finding 1A: Zero rate-limiting middleware exists (P0)

Every API route is rate-limit-unprotected. There is no IP-based throttling, no token-bucket, no upstash/redis rate limiter. The only `429` in the codebase is at `src/app/api/register/route.ts:54`, which is a **catch of Supabase Auth's own rate limit**, not the application enforcing one.

**Affected routes:**
- `POST /api/auth/sms/send` — no per-IP/per-phone limit; hardcoded code `888888`
- `POST /api/auth/sms/verify` — no brute-force protection
- `POST /api/demands/create` — no per-user cap
- `POST /api/payment/create` — no per-user cap
- `POST /api/demands/[id]/assign` — no per-provider frequency limit
- `POST /api/demands/[id]/match` — no per-user cap

**Severity:** P0 — SMS bombing, brute-force verification, demand spam all possible.

### Finding 1B: LockProvider interface is fully stubbed (P0)

`src/modules/m12-push/push-service.ts:20-35`
Both `DatabaseLockProvider.acquire()` and `RedisLockProvider.acquire()` unconditionally return `true`. No actual distributed lock is ever acquired.

```typescript
// line 24 — Database lock stub
async acquire(lockKey: string, ttlMs: number): Promise<boolean> {
  return true  // always succeeds — no lock
}
```

**Severity:** P0 — any concurrency path relying on these locks gets zero protection.

### Finding 1C: TOCTOU on `demands/[id]/match` route (P1)

`src/app/api/demands/[id]/match/route.ts:21-35`
The route validates demand state transition via `validateDemandTransition()`, then updates with `.eq('id', id)` — **without `.eq('status', ...)` optimistic locking**. Between validation and UPDATE, another request can change the demand status.

```typescript
const err = validateDemandTransition(demand.status, "MATCHED")  // check
if (err) return ... // early exit
// ⚠️ RACE WINDOW: another request can change demand.status here
await supabase.from('demands').update({ matched_provider_id: ..., status: MATCHED })
  .eq('id', id)  // ❌ no .eq('status', ...) guard
```

**Severity:** P1 — stale-state writes possible under concurrent match requests.

### Finding 1D: TOCTOU on `payment/create` WeChat/mock path (P1)

`src/app/api/payment/create/route.ts:114-131`
The WeChat and mock channels check `contract.fund_status` in memory, then update with `.eq('id', contract.id)` — **no `.eq('fund_status', ...)`**.

```typescript
if (contract.fund_status !== "PENDING" && contract.fund_status !== "PENDING_HELD") { ... }
// ⚠️ RACE: status can change here
await supabase.from('contracts').update({ fund_status: "HELD" }).eq("id", contract.id)
```

**Severity:** P1 — double-payment or duplicate `HELD` transitions possible.

### Finding 1E: In-process Sets for idempotency — not multi-instance-safe (P1)

`src/modules/m13-payment/payment-service.ts:509,548`
`processedIds` and `transferredKeys` are module-level `Set<string>` instances. In a multi-process deployment, each process has its own set, providing zero cross-instance deduplication.

**Severity:** P1 — duplicate charges/transfers possible with multiple replicas.

### Finding 1F: No CAPTCHA / bot mitigation anywhere (P2)

No reCAPTCHA, hCaptcha, Cloudflare Turnstile, or proof-of-work exists. SMS endpoints are fully automated-attack-able.

**Severity:** P2 — amplifies the impact of 1A.

---

## 2. Offline Push & Notification Reliability

### Finding 2A: NotificationBell only polls once — never refreshes (P1)

`src/components/NotificationBell.tsx:33-46`
`fetchNotifications` is called once in `useEffect` on mount. There is no polling interval, SSE subscription, or Realtime subscription. The badge count and notification list become stale immediately after page load.

```typescript
useEffect(() => { fetchNotifications(); }, [fetchNotifications]);  // ❌ only on mount
```

**Severity:** P1 — users miss real-time notifications (payment success, dispute updates).

### Finding 2B: Column name mismatch `read` vs `is_read` (P1)

Three inconsistencies exist across the notification system:

| Location | Field Used | Actual DB Column |
|----------|-----------|-----------------|
| `notifications/route.ts:36` (PATCH) | `.update({ read: true })` | `is_read` |
| `notifications/mark-read/route.ts:12,29` (POST) | `.update({ is_read: true })` | `is_read` ✅ |
| `NotificationBell.tsx:65` | `n.read` property access | `is_read` |

The DB column is `is_read`. The PATCH at `notifications/route.ts` writes to `read`, creating a **silent no-op** (wrong column). The UI reads `n.read` which is `undefined` for all notifications, making every notification always appear unread.

**Severity:** P1 — "mark all read" from the bell never works; unread count is always inflated.

### Finding 2C: No offline message retry queue (P1)

`src/modules/m12-push/push-service.ts:83-118`
`sendOfflineNotification()` attempts VAPID/FCM push once. On failure (device offline, FCM error, VAPID timeout), the message is silently dropped. There is no dead-letter queue, exponential-backoff retry, or delivery confirmation.

```typescript
try {
  await webpush.sendNotification(...)
} catch {
  console.warn(`[M12] VAPID send failed`)  // ❌ silently dropped
}
```

**Severity:** P1 — providers can miss critical "new match available" notifications.

### Finding 2D: ServiceWorker has no `push` event listener (P1)

`public/sw.js`
The Serwit-generated service worker only handles pre-caching (`PrecacheStrategy`). There is no `self.addEventListener('push')` or `notificationclick` handler. Browser push notifications are received but **never displayed**.

**Severity:** P1 — VAPID/FCM payloads reach the browser but produce zero user-visible notifications.

### Finding 2E: SSE cleanup leak in `useSSE` (P2)

`src/lib/use-sse.ts:14-18`
When SSE connection errors, the `onerror` handler closes the EventSource and starts a 5s poll interval. But the poll interval reference is lost — `setInterval` returns a number, and returning it from `onerror` has no effect. The interval runs indefinitely.

```typescript
es.onerror = () => {
  es.close()
  const fallback = setInterval(() => onEventRef.current(), 5000)  // ❌ never cleaned up
  return cleanup  // this return does nothing in an event handler
}
```

**Severity:** P2 — memory/resource leak on SSE failures.

### Finding 2F: Dual live-update channels create implicit race (P2)

The order detail page simultaneously subscribes to:
1. SSE via `useSSE` (event-bus broadcasting)
2. Supabase Realtime via `useOrderRealtime` (postgres_changes on `orders` table)

Both channels trigger re-renders independently. An event emitted BEFORE the DB commit arrives via SSE, causing the UI to refetch stale data.

**Severity:** P2 — transient stale-data flashes during high-frequency updates.

---

## 3. Team Formation & Group Payout Closing

### Finding 3A: `settlePayment` never writes `orders.fund_status = 'SETTLED'` (P0)

`src/modules/m13-payment/payment-service.ts:233-241`
After releasing escrow, `settlePayment()` updates `escrow_status = 'released'` and `protocols.status = 'settled'`, but `orders.fund_status` stays at `'COMPLETED'`. The fund_status lifecycle is incomplete.

```typescript
await getSupabase().from('orders').update({ escrow_status: 'released' }) // ✅
  .eq('id', order.id)
await getSupabase().from('protocols').update({ status: 'settled' })     // ✅
// ❌ orders.fund_status is still 'COMPLETED'
```

**Severity:** P0 — any downstream query filtering by `fund_status = 'SETTLED'` will miss settled orders indefinitely.

### Finding 3B: `refundByPhase` never updates `orders.fund_status` (P0)

`src/modules/m13-payment/payment-service.ts:371-379`
After refund, `escrow_status = 'refunded'` and `protocols.status = 'cancelled'` are set, but `orders.fund_status` is never touched.

```typescript
.from('orders').update({ escrow_status: 'refunded' })         // ✅
.from('protocols').update({ status: 'cancelled' })             // ✅
// ❌ orders.fund_status is still 'COMPLETED' — data says settled when it's refunded
```

**Severity:** P0 — financial reporting is inaccurate for refunded orders.

### Finding 3C: Team leader is never paid in `splitTeamPayment` (P0)

`src/modules/m13-payment/payment-service.ts:226-231, 448-480`
When `origin_type === 'contractor_self_funded'`, `settlePayment()` calls `splitTeamPayment(protocolId)`. That function pays **only team members** (`team_requests WHERE status = 'filled'`). The team leader (`protocol.provider_id`) receives zero payout.

```typescript
// settlePayment line 226-231
if (protocol.origin_type === 'contractor_self_funded') {
  await splitTeamPayment(protocolId)     // pays members only
  // ❌ leader (protocol.provider_id) is never paid via performTransfer
}
```

The leader's `providerIncome` (holdAmount - platformFee - satisfactionHold) is **completely unallocated**.

**Severity:** P0 — team leaders lose their entire earnings on every team protocol.

### Finding 3D: M13 `orders` and system `contracts` are dual-track and never sync (P1)

M13 manages fund status on `orders.fund_status` / `orders.escrow_status`, while the rest of the system uses `contracts.fund_status`. The flow:

| Event | `orders` updated | `contracts` updated | Gap |
|-------|-----------------|-------------------|-----|
| `holdPayment` | `escrow_status: held` | ✗ | Some paths write `contracts.fund_status = 'HELD'` but not through M13 |
| `confirmCompletion` | `fund_status: COMPLETED` | ✗ | Only `protocols.status = 'satisfaction_held'` |
| `settlePayment` | `escrow_status: released` | ✗ | `contracts.fund_status` stays at prior value |
| `freezeForDispute` | `escrow_status: disputed` | ✗ | Only `protocols.status = 'disputed'` |
| `refundByPhase` | `escrow_status: refunded` | ✗ | Only `protocols.status = 'cancelled'` |
| SLA enforcer | ✗ | `fund_status: CANCELLED` | SLA never touches `orders` |
| Auto-transitions | ✗ | Uses `contracts.fund_status` | Never reads `orders` |
| Provider settle | ✗ | `fund_status: SATISFACTION_HELD` | Never reads `orders` |
| Dispute resolver | ✗ | `fund_status: DISPUTED / SETTLED` | Never reads `orders` |

**Severity:** P1 — two parallel fund-status machines with zero cross-synchronization.

### Finding 3E: `settlePayment` doesn't validate current `orders.fund_status` (P1)

`src/modules/m13-payment/payment-service.ts:204-256`
`settlePayment()` reads the order but never checks `order.fund_status === 'COMPLETED'` before releasing escrow. If called on an order still in `HELD`, funds are released prematurely.

**Severity:** P1 — premature fund release possible.

### Finding 3F: `confirmCompletion` sets `protocols.status = 'completed'` then immediately overwrites to `'satisfaction_held'` (P2)

`src/modules/m13-payment/payment-service.ts:185-198`
The `'completed'` status is never observable — it's overwritten in the same function. Any listener waiting for `protocols.status = 'completed'` will never see it.

**Severity:** P2 — unreachable status value; confuses event-driven consumers.

---

## 4. Data Lifecycle, Cascade & Privacy Compliance

### Finding 4A: No user account deletion mechanism exists (P0)

There is no `DELETE /api/profile` endpoint, no soft-delete column (`is_deleted`, `deleted_at`) anywhere, and no admin tool to anonymize or remove user data. GDPR right-to-erasure / right-to-be-forgotten is entirely unaddressed.

**Affected tables that accumulate PII:** `profiles`, `users`, `provider_qualifications`, `order_reviews`, `evidence_log` (contains phone numbers via privacy-guard), `notifications`.

**Severity:** P0 — regulatory non-compliance for any jurisdiction with data protection laws.

### Finding 4B: `profiles` cascade chain can silently destroy financial records (P1)

`supabase/migrations/012_payment_and_wallets.sql`, `014_provider_withdrawals.sql`, `015_notifications_system.sql`, `016_reputation_system.sql`
Six foreign keys use `ON DELETE CASCADE` on `profiles(id)`:

| Migration | Table | Foreign Key |
|-----------|-------|-------------|
| `012` | `provider_wallets` | `provider_id → profiles(id) CASCADE` |
| `012` | `wallet_logs` | `provider_id → profiles(id) CASCADE` |
| `014` | `withdrawal_requests` | `provider_id → profiles(id) CASCADE` |
| `015` | `notifications` | `user_id → profiles(id) CASCADE` |
| `016` | `order_reviews` | `reviewer_id → profiles(id) CASCADE` |
| `016` | `order_reviews` | `reviewee_id → profiles(id) CASCADE` |
| `017` | `developer_profiles` | `id → profiles(id) CASCADE` |

Deleting a single `profiles` row would silently destroy wallets, transaction history, and reviews. Even if a soft-delete is added later, a `DELETE` statement (admin-level or via `service_role`) would trigger the cascade chain.

**Severity:** P1 — irreversible financial data loss on any profile deletion.

### Finding 4C: `evidence_log` is RLS-protected from deletion but has no archival strategy (P1)

`supabase/migrations/001_schema.sql:285-297`
RLS blocks all UPDATE and DELETE on `evidence_log`, which is correct. FK references to `protocols(id)`, `orders(id)`, and `users(id)` use default `NO ACTION` (no cascade), preventing parent deletion. **However:**

- No archival policy exists — evidence records grow unbounded.
- No TTL or retention limit.
- No backup/external cold-storage strategy for forensic integrity.

**Severity:** P1 — long-term storage costs grow unbounded; no disaster recovery for judicial evidence.

### Finding 4D: Triple user-table ambiguity (`public.users`, `public.profiles`, `auth.users`) (P2)

Foreign keys in the schema reference three separate user tables:

| Table | Referenced By |
|-------|---------------|
| `public.users` (001_schema) | `protocols`, `provider_qualifications`, `orders`, `credit_records`, `team_requests`, etc. |
| `public.profiles` (auth hook / 002) | `provider_wallets`, `wallet_logs`, `withdrawal_requests`, `notifications`, `order_reviews` |
| `auth.users` (Supabase Auth) | `demands`, `contracts` (via 20260723_fix) |

There is **no synchronization guarantee** between these tables. A user present in `auth.users` may not have a corresponding `public.profiles` row.

**Severity:** P2 — FK violation risk on cross-table joins; user enumeration ambiguity.

### Finding 4E: `contracts` FK chain can cascade-delete evidence if protection is bypassed (P2)

`20260723_fix_missing_ddl_and_rls.sql` adds `ON DELETE CASCADE` on `contracts → demands → auth.users`. And `20260724_insurance_pool.sql` adds `ON DELETE CASCADE` on `insurance_pool → contracts`.

If a `contracts` row were deleted (direct SQL bypassing RLS), `insurance_pool` records would cascade-delete. Though `evidence_log` references `protocols` (not `contracts`) with NO ACTION, the evidence chain's integrity relies on `protocols` never being cascade-deleted.

**Severity:** P2 — indirect evidence invalidation risk.

---

## Fix Plan

### P0 — Fix immediately

| ID | Fix | File(s) | Effort |
|----|-----|---------|--------|
| P0-1 | **Rate limiting middleware**: add per-IP/per-phone token bucket for SMS, demands, payment, and grab endpoints. Use Supabase advisory lock or Redis. | `src/lib/rate-limit.ts` (new), `src/app/api/auth/sms/send/route.ts`, `src/app/api/demands/create/route.ts`, `src/app/api/demands/[id]/assign/route.ts`, `src/app/api/payment/create/route.ts` | 2d |
| P0-2 | **Fix LockProvider implementations**: implement actual DB-based locking (pg_try_advisory_lock) for `DatabaseLockProvider` and actual Redis locking for `RedisLockProvider`. | `src/modules/m12-push/push-service.ts:20-35` | 1d |
| P0-3 | **Add `orders.fund_status = 'SETTLED'`** in `settlePayment()`. | `src/modules/m13-payment/payment-service.ts:233-241` | 0.5d |
| P0-4 | **Add `orders.fund_status = 'CANCELLED'`** in `refundByPhase()`. | `src/modules/m13-payment/payment-service.ts:371-379` | 0.5d |
| P0-5 | **Fix `splitTeamPayment`**: after paying members, pay the team leader `performTransfer(protocol.provider_id, leaderShare, ...)`. The leader's share = `providerIncome - sum(member rewards)`. | `src/modules/m13-payment/payment-service.ts:226-231, 448-480` | 1d |
| P0-6 | **Implement user account deletion pathway**: add DELETE handler in profile route; implement soft-delete (`profiles.is_deleted`, `profiles.deleted_at`); add admin GDPR export endpoint. | `src/app/api/profile/route.ts` (new DELETE), `supabase/migrations/` (new migration) | 2d |
| P0-7 | **Remove dangerous cascades**: change `ON DELETE CASCADE` to `ON DELETE SET NULL` or `ON DELETE RESTRICT` on `provider_wallets`, `wallet_logs`, `withdrawal_requests`, `notifications`, `order_reviews`. | `supabase/migrations/012`, `014`, `015`, `016` | 1d |

### P1 — Fix within sprint

| ID | Fix | File(s) | Effort |
|----|-----|---------|--------|
| P1-1 | **Fix TOCTOU on `demands/[id]/match`**: add `.eq('status', currentStatus)` before UPDATE. | `src/app/api/demands/[id]/match/route.ts:32-35` | 0.25d |
| P1-2 | **Fix TOCTOU on `payment/create`**: add `.eq('fund_status', ...)` on WeChat/mock UPDATE. | `src/app/api/payment/create/route.ts:114-131` | 0.25d |
| P1-3 | **Replace in-process Sets with DB idempotency**: use `payments.provider_payment_id` lookup (like Stripe webhook already does). | `src/modules/m13-payment/payment-service.ts:509,548` | 1d |
| P1-4 | **Add NotificationBell polling**: 30s `setInterval` refresh. | `src/components/NotificationBell.tsx:33-46` | 0.25d |
| P1-5 | **Fix column name `read` → `is_read`** in `notifications/route.ts` PATCH handler. | `src/app/api/notifications/route.ts:33` | 0.05d |
| P1-6 | **Add offline notification retry queue**: new table `notification_retry_queue` + cron job with exponential backoff (30s, 2min, 10min, max 3 retries). | `src/modules/m12-push/push-service.ts` (new), `supabase/migrations/` (new) | 2d |
| P1-7 | **Add ServiceWorker push event listeners**: register `push` and `notificationclick` handlers. | `public/sw.js` → convert to `sw.ts` with Serwist injection | 0.5d |
| P1-8 | **Remove `protocols.status = 'completed'` intermediate overwrite** in `confirmCompletion`. | `src/modules/m13-payment/payment-service.ts:185-198` | 0.1d |
| P1-9 | **Add `settlePayment` fund_status validation**: check `order.fund_status === 'COMPLETED'` before release. | `src/modules/m13-payment/payment-service.ts:213` | 0.1d |
| P1-10 | **Add `is_read` column normalization**: write a data migration to backfill any rows where `read` was accidentally written as a separate column; add a DB trigger to ensure consistency. | `supabase/migrations/` (new) | 0.5d |

### P2 — Fix when convenient

| ID | Fix | File(s) | Effort |
|----|-----|---------|--------|
| P2-1 | **Unify SSO/Realtime live channels**: remove one of the two parallel live-update channels for orders. | `src/lib/use-sse.ts`, `src/hooks/use-order-realtime.ts` | 0.5d |
| P2-2 | **Fix `useSSE` cleanup**: store `setInterval` ref in a ref and clear in useEffect return. | `src/lib/use-sse.ts:14-18` | 0.1d |
| P2-3 | **Add CAPTCHA** to SMS send and register endpoints. | `src/app/api/auth/sms/send/route.ts`, `src/app/api/register/route.ts` | 1d |
| P2-4 | **Normalize user table references**: add DB triggers to sync `public.users`, `public.profiles`, and `auth.users` on INSERT. | `supabase/migrations/` (new) | 1d |
| P2-5 | **Add evidence_log archival policy**: archive records older than 3 years to cold storage (JSON export + S3 Glacier). | `src/app/api/cron/archive-evidence/route.ts` (new) | 1d |

---

## Verification

After implementing the fix plan:

```bash
npx vitest run
# Expected: all project tests pass (pre-existing .opencode/zod failures excluded)
```

Baseline before this audit: **1700 passed / 1 failed** (e2e mock issue, pre-existing).

---

## Files Scanned (complete list)

### Rate Limiting & Anti-Spam
- `src/app/api/auth/sms/send/route.ts`
- `src/app/api/auth/sms/verify/route.ts`
- `src/lib/sms-code-store.ts`
- `src/app/api/register/route.ts`
- `src/app/api/demands/route.ts`
- `src/app/api/demands/create/route.ts`
- `src/app/api/demands/[id]/route.ts`
- `src/app/api/demands/[id]/assign/route.ts`
- `src/app/api/demands/[id]/match/route.ts`
- `src/app/api/demands/[id]/status/route.ts`
- `src/app/api/demands/list/route.ts`
- `src/app/api/demands/nearby/route.ts`
- `src/app/api/payment/create/route.ts`
- `src/app/api/payment/escrow/route.ts`
- `src/app/api/payment/notify/route.ts`
- `src/app/api/payment/release/route.ts`
- `src/app/api/payment/status/route.ts`
- `src/modules/m12-push/push-service.ts`
- `src/lib/matching/engine.ts`
- `src/lib/matching/ranker.ts`
- `src/lib/fraud-detection.ts`
- `src/lib/fraud-detection/cluster-detection.ts`
- `src/lib/fraud-detection/circle-detection.ts`
- `src/modules/m09-content-audit/content-audit.ts`
- `src/app/api/admin/complaints/route.ts`
- `src/app/api/admin/arbitrate/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/track-metric.ts`

### Notification Pipeline
- `src/modules/m12-push/push-service.ts`
- `src/lib/event-bus.ts`
- `src/app/api/sse/route.ts`
- `src/lib/use-sse.ts`
- `src/hooks/use-order-realtime.ts`
- `src/components/NotificationBell.tsx`
- `src/components/Header.tsx`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/list/route.ts`
- `src/app/api/notifications/mark-read/route.ts`
- `src/app/api/ai/push-recommendations/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/webhooks/wechat/route.ts`
- `src/app/api/webhooks/alipay/route.ts`
- `src/app/api/payment/notify/route.ts`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/admin/reputation/amnesty/route.ts`
- `src/modules/m10-sos/sos-service.ts`
- `public/sw.js`
- `src/app/layout.tsx`
- `src/lib/use-contract-sound.ts`

### Team Formation & Payouts
- `src/modules/m14-team-formation/team-formation.ts`
- `src/modules/m13-payment/payment-service.ts`
- `tests/m14-team-formation.test.ts`
- `tests/m13-payment.test.ts`

### Data Lifecycle & Privacy
- `src/modules/m11-evidence-log/evidence-chain.ts`
- `src/lib/workflow-evidence-tracker.ts`
- `src/lib/privacy-guard.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/user/[id]/route.ts`
- `src/app/api/register/route.ts`
- `tests/workflow-evidence.test.ts`
- `supabase/migrations/001_schema.sql`
- `supabase/migrations/002_create_user_fn.sql`
- `supabase/migrations/012_payment_and_wallets.sql`
- `supabase/migrations/014_provider_withdrawals.sql`
- `supabase/migrations/015_notifications_system.sql`
- `supabase/migrations/016_reputation_system.sql`
- `supabase/migrations/017_ai_matching_system.sql`
- `supabase/migrations/20260723_fix_missing_ddl_and_rls.sql`
- `supabase/migrations/20260723_fix_admin_rls_rbac.sql`
- `supabase/migrations/20260724_anti_fraud.sql`
- `supabase/migrations/20260724_insurance_pool.sql`
