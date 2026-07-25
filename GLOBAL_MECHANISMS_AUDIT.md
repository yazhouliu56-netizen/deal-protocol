# Global Mechanisms Audit Report

Audit Date: 2026-07-25  
Scope: `src/` + `supabase/migrations/`

---

## 1. SLA Enforcement (履约倒计时 & 超时违约)

### 1.1 Existing Architecture Base

| Component | File | Status |
|-----------|------|--------|
| `auto_complete_at` field on `contracts` | `supabase/migrations/20260723_fix_missing_ddl_and_rls.sql:24-33` | ✅ Exists |
| Auto-complete transition in engine | `src/lib/protocol/protocols/base.ts:42` | ✅ Exists |
| `auto_complete` engine validation | `src/lib/protocol/engine.ts:59-87` | ✅ Exists |
| 60s polling loop (`startAutoTransitions`) | `src/lib/auto-transitions.ts:7-13` | ✅ Exists |
| CRON `/api/cron/check-timeouts` (CRON_SECRET guarded) | `src/app/api/cron/check-timeouts/route.ts` | ✅ Exists |
| `auto_complete_at` set on `confirm_arrival` | `src/app/api/orders/[id]/route.ts:336-342` | ✅ Exists |
| `auto_complete_at` cleared on `confirm_complete` / dispute | `src/app/api/orders/[id]/route.ts:336-342, 393` | ✅ Exists |
| Satisfaction batch release (30-day fallback) | `src/lib/contract/satisfaction.ts` | ✅ Exists |
| Insurance pool table (`insurance_pool`) | `supabase/migrations/20260724_insurance_pool.sql` | ✅ Exists |
| 1% insurance provision on `holdPayment()` | `src/modules/m13-payment/payment-service.ts:108-119` | ✅ Exists |

### 1.2 Gaps

| Gap | Severity | Details |
|-----|----------|---------|
| No per-stage SLA timeout | **HIGH** | `DEPARTED`→`ARRIVED`, `ARRIVED`→`IN_PROGRESS` have no deadline. Only the final auto-complete (completion → auto-confirm) is timed. |
| No SLA breach detection | **HIGH** | No cron/event that detects "provider at DEPARTED for >X min" and triggers penalty |
| No SLA config in ProtocolDef | **MEDIUM** | `CompletionDef` has `autoTimeoutSeconds`, but there's no per-stage timeout config in `ProtocolDef` |
| No insurance_pool auto-deduction for SLA breach | **MEDIUM** | The pool is provisioned (1%) but never debited for SLA violations |
| No `SLA_BREACH` event type in state machine | **LOW** | No transition/state for SLA breach — all timeout logic is auto-complete only |

### 1.3 Integration Plan

**Step 1 — Add SLA config to ProtocolDef (`src/lib/protocol/types.ts`):**
```typescript
// After line 275 (CompletionDef), add:
export interface SLADef {
  stage: string        // e.g. 'DEPARTED'
  maxSeconds: number   // max duration before breach
  penaltyPercent?: number  // penalty % from insurance_pool (default 100%)
}
// Add to ProtocolDef (around line 366):
sla?: SLADef[]
```

**Step 2 — Add SLA breach transition to base protocols:**
```
src/lib/protocol/protocols/base.ts:42 — append:
{ action: "sla_breach", from: "HELD", to: "DISPUTED", allowedRoles: ["system"] }
```

**Step 3 — Create SLA watchdog (`src/app/api/cron/check-sla/route.ts`):**
- Query contracts where `fund_status = 'HELD'` and `service_stage` has exceeded its SLA window
- For each breach: validate `sla_breach` transition, update fund_status to `DISPUTED`, deduct penalty from `insurance_pool`, create event

**Step 4 — Wire into `src/instrumentation.ts:8-10`** to also start an SLA polling loop alongside `startAutoTransitions`.

---

## 2. Provider Deposit Staking (服务商保证金 & 派单加权)

### 2.1 Existing Architecture Base

| Component | File | Status |
|-----------|------|--------|
| `provider_wallets` table (balance + provider_id) | `supabase/migrations/012_payment_and_wallets.sql:6-11` | ✅ Exists |
| `guarantee_links` table (guarantor, stake_amount, status) | `supabase/migrations/001_schema.sql:158-169` | ✅ Exists (unused in matching) |
| `init_provider_wallet` trigger | `supabase/migrations/012_payment_and_wallets.sql:56-66` | ✅ Exists |
| `StaticRanker` | `src/modules/m06-matching-routing/matcher.ts:14-24` | ✅ Exists |
| `BanditRanker` | `src/modules/m08-bandit/bandit-ranker.ts:5-41` | ✅ Exists |
| `getCreditTierPrivileges().matchingWeight` | `src/lib/credit-privileges.ts:6` | ✅ Exists (0.5-1.5) |
| `CandidateProvider` type | `src/lib/contracts.ts:142-148` | ✅ Exists |
| Withdrawal RPC (`submit_withdrawal_request`) | `supabase/migrations/014_provider_withdrawals.sql:34-77` | ✅ Exists |

### 2.2 Gaps

| Gap | Severity | Details |
|-----|----------|---------|
| `provider_wallets` lacks `deposit_amount` and `is_staked` | **HIGH** | No way to distinguish staked vs unstaked providers |
| Ranker formulas don't include staking weight | **HIGH** | `StaticRanker` formula: `credit_score * 20 * tier.matchingWeight - distance_m/100` — no deposit bonus. Same for `BanditRanker`. |
| `CandidateProvider` type has no `deposit_amount` field | **MEDIUM** | Can't pass staking info through the matching pipeline |
| No staking deposit flow | **MEDIUM** | There's no endpoint that lets providers lock funds as deposit |
| `guarantee_links` table exists but is dead code | **MEDIUM** | Has `stake_amount`, `guarantee_type`, `status` — but never queried by matcher |
| No minimum deposit requirement per category | **LOW** | Category configs have no `min_deposit` field |

### 2.3 Integration Plan

**Step 1 — Alter `provider_wallets` (new migration):**
```sql
ALTER TABLE provider_wallets ADD COLUMN deposit_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE provider_wallets ADD COLUMN is_staked BOOLEAN DEFAULT FALSE;
```

**Step 2 — Extend `CandidateProvider` (`src/lib/contracts.ts:142-148`):**
```typescript
export interface CandidateProvider {
  provider_id: string;
  distance_m: number;
  credit_score: number;
  category_score: number;
  skills: string[];
  deposit_amount?: number;  // NEW
}
```

**Step 3 — Modify `processCandidates` (`matcher.ts:136-150`):**
After `cs` calculation, batch-load deposit amounts:
```typescript
const { data: walletData } = await getSupabase()
  .from('provider_wallets')
  .select('provider_id, deposit_amount')
  .in('provider_id', providerIds)
const depositMap = new Map((walletData ?? []).map(w => [w.provider_id, w.deposit_amount ?? 0]))
```
Then pass into each `candidateRecords` entry.

**Step 4 — Modify `StaticRanker.rank()` (`matcher.ts:15-23`):**
```typescript
const scoreA = a.credit_score * 20 * tierA.matchingWeight - a.distance_m / 100
  + (a.deposit_amount ?? 0) / 100 * 0.2  // +20% staking bonus
```

**Step 5 — Add `/api/deposit/stake` and `/api/deposit/unstake` endpoints** for providers to lock/unlock deposit from their wallet balance.

---

## 3. Privacy Proxy Guard (隐私中间号 & 手机号防护)

### 3.1 Existing Architecture Base

| Component | File | Status |
|-----------|------|--------|
| `encryptPII` / `decryptPII` (aes-256-gcm) | `src/lib/pii-encrypt.ts:12-35` | ✅ Exists |
| `maskPII` (shows last N chars) | `src/lib/pii-encrypt.ts:37-42` | ✅ Exists |
| `interceptChatRisk()` (phone detection + masking in chat) | `src/lib/risk-interceptor.ts:16-35` | ✅ Exists |
| AI arbitrator already masks phone (`138****0000`) | `src/lib/ai-arbitrator.ts:178` | ✅ Exists |

### 3.2 Phone Exposure Inventory

| Endpoint / File | Exposed Data | Risk |
|-----------------|-------------|------|
| `GET /api/profile` (`src/app/api/profile/route.ts:10`) | Raw `phone` from `profiles` table | **HIGH** — returned to authenticated user, but no encryption at rest |
| `PATCH /api/profile` (`src/app/api/profile/route.ts:42`) | Accepts raw `phone`, stores unencrypted | **HIGH** — phone stored in plaintext in DB |
| `GET /api/orders/[id]` (`src/app/api/orders/[id]/route.ts:184-188`) | Both `provider.phone` and `customer.phone` returned in full | **HIGH** — every order participant sees the other party's real phone |
| `GET /api/admin/review` (`src/app/api/admin/review/route.ts:43,53`) | `profiles.phone` returned to admin | **MEDIUM** — admin-only, but no masking |
| `src/modules/m10-sos/sos-service.ts:104,169,207` | Admin phones & user's emergency contact phone in SMS/console logs | **MEDIUM** — internal but logged in plaintext |
| `src/modules/m10-sos/sos-service.ts:169` | User's `profiles.phone` read for fallback contact | **MEDIUM** |
| `src/lib/auth.ts:76` | Phone from auth metadata | **LOW** — only during signup |

### 3.3 Gaps

| Gap | Severity | Details |
|-----|----------|---------|
| No virtual/transient number generation | **HIGH** | Both parties see each other's real phone — should use temp proxy numbers |
| No PII encryption at rest | **HIGH** | Phone stored plaintext in `profiles.phone`, not using `encryptPII()` |
| Order API exposes raw phone | **HIGH** | `GET /api/orders/[id]` should mask or omit phone; use in-app chat instead |
| No phone masking at API boundary | **MEDIUM** | No middleware or interceptor that auto-masks phone in API responses |
| `PII_ENCRYPTION_KEY` exists but unused | **MEDIUM** | `encryptPII`/`decryptPII` defined in `pii-encrypt.ts` but never called anywhere |

### 3.4 Integration Plan

**Step 1 — Encrypt phone at rest:**
In `PATCH /api/profile/route.ts:42`, before saving:
```typescript
import { encryptPII } from '@/lib/pii-encrypt'
if (phone !== undefined) updateData.phone = encryptPII(phone)
```

**Step 2 — Mask phone in order API (`src/app/api/orders/[id]/route.ts:184-188`):**
```typescript
import { maskPII } from '@/lib/pii-encrypt'
// ...
phone: maskPII(providerRes.data.phone, 4),  // "****5678"
// ...
phone: maskPII(customerRes.data.phone, 4),
```

**Step 3 — Create virtual number system (`src/lib/virtual-number.ts`):**
- Generate transient numbers tied to (contract_id, role) with TTL
- On order creation, allocate two virtual numbers
- On order settlement, release them

**Step 4 — Add phone masking middleware** for admin endpoints (or at least apply `maskPII` in `src/app/api/admin/review/route.ts:43,53`).

---

## 4. Instant Payout Engine (T+0 极速提现)

### 4.1 Existing Architecture Base

| Component | File | Status |
|-----------|------|--------|
| `fastWithdrawal` in CreditTier (level 4-5) | `src/lib/credit-privileges.ts:8,14,16` | ✅ Exists (but unused) |
| `settlePayment()` (SATISFACTION_HELD → SETTLED + transfer) | `src/modules/m13-payment/payment-service.ts:203-253` | ✅ Exists |
| `performTransfer()` (idempotent, simulated) | `src/modules/m13-payment/payment-service.ts:511-524` | ✅ Exists |
| `withdrawal_requests` table | `supabase/migrations/014_provider_withdrawals.sql:5-17` | ✅ Exists |
| `submit_withdrawal_request` RPC (SECURITY DEFINER) | `supabase/migrations/014_provider_withdrawals.sql:34-77` | ✅ Exists |
| `provider_wallets.balance` (tracks available funds) | `supabase/migrations/012_payment_and_wallets.sql:6-11` | ✅ Exists |
| `wallet_logs` (audit trail) | `supabase/migrations/012_payment_and_wallets.sql:14-22` | ✅ Exists |
| `getCreditTierPrivileges(score)` | `src/lib/credit-privileges.ts:12-24` | ✅ Exists |

### 4.2 Gaps

| Gap | Severity | Details |
|-----|----------|---------|
| `fastWithdrawal` flag is defined but never checked | **HIGH** | No code reads `fastWithdrawal` to skip manual review |
| `withdrawal_requests.status` CHECK doesn't include `'instant'` | **HIGH** | Schema blocks auto-approved status; only `pending/approved/rejected` are valid |
| `settlePayment()` doesn't check credit tier | **MEDIUM** | Goes through same path for all providers — no fast path for tier 4-5 |
| `performTransfer()` is simulated | **MEDIUM** | Uses `setTimeout(150)` — no real payout integration |
| Manual review is the only path | **MEDIUM** | `submit_withdrawal_request` always inserts with `status='pending'`, requiring admin approval |
| No `getCreditScore` call in settlePayment | **LOW** | settlePayment has no access to the provider's credit score to check tier |

### 4.3 Integration Plan

**Step 1 — Extend `withdrawal_requests` status (new migration):**
```sql
ALTER TABLE withdrawal_requests DROP CONSTRAINT chk_withdrawal_status;
ALTER TABLE withdrawal_requests ADD CONSTRAINT chk_withdrawal_status
  CHECK (status IN ('pending', 'approved', 'rejected', 'instant'));
```

**Step 2 — Create `fastSettlePayment()` in `payment-service.ts`:**

```typescript
export async function fastSettlePayment(
  protocolId: string,
  providerId: string,
): Promise<{ success: boolean }> {
  const { getCreditScore } = await import('@/modules/m07-credit/credit-engine')
  const credit = await getCreditScore(providerId)
  const tier = getCreditTierPrivileges(credit.baseScore)
  if (!tier.fastWithdrawal) {
    return { success: false, message: 'Tier 4+ required for instant settlement' }
  }

  const result = await settlePayment(protocolId)
  if (!result.success) return result

  // Record as instant withdrawal
  await getSupabase().from('withdrawal_requests').insert({
    provider_id: providerId,
    amount: /* provider_income from order */,
    channel: 'auto',
    account_info: 'instant_settle',
    status: 'instant',
  })
  return result
}
```

**Step 3 — Wire into `handleSatisfactionBatch`:**
In `releaseSatisfactionBatch()` (`src/lib/contract/satisfaction.ts:111-129`), after updating each contract to SETTLED, batch-check provider's credit tier and call `fastSettlePayment` if eligible.

**Step 4 — Replace `performTransfer` simulation** with real Stripe Connect / Alipay transfer when `STRIPE_SECRET_KEY` or payout API keys are configured.

---

## 5. Implementation Sequence

```
Phase 1 (Parallel, no cross-dependency):
  ├── 1a: SLA config types + ProtocolDef extension (types.ts)
  ├── 2a: provider_wallets migration (deposit_amount, is_staked)
  └── 4a: withdrawal_requests migration (instant status)

Phase 2 (Parallel):
  ├── 1b: SLA watchdog cron + insurance_pool deduction
  ├── 2b: CandidateProvider + ranker formula update
  ├── 3a: PII encryption on write (profile PATCH)
  ├── 3b: Mask phone in order API response
  └── 4b: fastSettlePayment implementation

Phase 3 (Higher risk / new endpoints):
  ├── 1c: Wire SLA polling into instrumentation.ts
  ├── 2c: Deposit stake/unstake API endpoints (new)
  ├── 3c: Virtual number system (src/lib/virtual-number.ts)
  └── 4c: Wire fastSettlePayment into handleSatisfactionBatch

Phase 4 (Production hardening):
  ├── 2d: Add min_deposit to category_configs
  ├── 3d: Phone masking middleware for admin endpoints
  └── 4d: Real payout provider integration (Stripe Connect)
```

**Recommended priority order:** Phase 1 items first (schema changes) → Phase 2 (no new endpoints) → Phase 3 (new endpoints, higher risk) → Phase 4 (hardening).

---

## 6. Test Impact

No existing tests will break — all changes are additive:
- New migrations add columns (safe ALTER TABLE ADD COLUMN)
- New ranker fields are optional (backward-compatible)
- Phone masking changes API response shape (additive, not breaking)
- `fastWithdrawal` flag is read-only additive

**Post-implementation test verification:**
```bash
npx vitest run
```
All 1685+ existing tests must remain passing.
