# Deal Protocol — AI Handoff

> Generated: 2026-07-23 | Stack: Next.js 16 App Router + Supabase + Stripe
> Next LLM: read this file **first** — it replaces 2 hours of exploration.

---

## 1. Project Snapshot & Environment Baseline

### Tech Stack (key versions)

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js App Router | ^16.0.0 |
| Language | TypeScript (strict) | ^5.8.0 |
| Database | Supabase PostgreSQL | 15.x (service_role + RLS) |
| Auth | @supabase/ssr | ^0.6.1 (NO LONGER auth-helpers-nextjs) |
| Payment | Stripe SDK | ^22.3.0 |
| AI | @ai-sdk/google + @ai-sdk/openai-compatible | latest |
| PWA | @serwist/next | ^9.5.11 |
| UI | @base-ui/react + Tailwind CSS v4 + framer-motion | latest |
| State | zustand | ^5.0.0 |
| Test | vitest + @playwright/test | latest |

### Build Status

```
tsc --noEmit:   ✅  0 errors
npm run build:  ✅  97/97 pages, 0 errors
vitest:         ✅  21/22 files, 112/113 tests (1 pre-existing E2E mock failure in e2e-integration.test.ts — isColdStart export)
```

### Git Baseline

```
Branch: master | Latest: fc40a0f — "fix: resolve login redirect and session sync bugs"
Tag: v1.0.0
Remote: https://github.com/yazhouliu56-netizen/deal-protocol.git
```

### Environment Variables (required for .env.local)

Source: `.env.example` (43 vars). Critical subset:

| Var | Type | Source |
|-----|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | same |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | same (service_role) |
| `STRIPE_SECRET_KEY` | secret | Stripe Dashboard (sk_live_ for prod) |
| `STRIPE_WEBHOOK_SECRET` | secret | Stripe Webhooks (whsec_...) |
| `GEMINI_API_KEY` | secret | Google AI Studio |
| `CRON_SECRET` | secret | self-generated 32-char random |
| `PII_ENCRYPTION_KEY` | secret | self-generated 128-bit hex |
| `PAYMENT_SANDBOX` | config | `false` for production |
| `NEXT_PUBLIC_SITE_URL` | public | https://deal-protocol-phi.vercel.app |

---

## 2. Core Architecture & File Map

### Entry Points

| File | Role |
|------|------|
| `src/proxy.ts` | Next.js 16 proxy (middleware replacement). **Auth token refresh + route protection.** |
| `src/app/layout.tsx` | Root layout. Mounts `SessionProvider` + `UXProvider` + `Header`. Registers SW. |
| `src/instrumentation.ts` | Next.js `register()`. Bootstraps `syncBuiltinsToDb` + `startAutoTransitions`. |

### Auth Layer

| File | Role |
|------|------|
| `src/lib/supabase-route-client.ts` | **`getRouteClient()`** — `createServerClient` from `@supabase/ssr`. Used by API routes. |
| `src/lib/supabase-browser.ts` | **`getBrowserSupabase()`** — `createBrowserClient` from `@supabase/ssr`. Browser singleton. |
| `src/lib/supabase-client.ts` | **`getSupabase()`** (no session, for lib code) + **`getServiceClient()`** (service_role). |
| `src/lib/api-auth.ts` | **`withAuth(handler)`** — HOF that wraps API routes with `getUser()` check + passes `user` object. |
| `src/components/SessionProvider.tsx` | React Context. Calls `supabase.auth.getSession()` + fetches `/api/profile` for role. Listens to `onAuthStateChange`. |

### Page Routes (key pages)

| Route | File | Type |
|-------|------|------|
| `/login` | `src/app/login/page.tsx` | Client, email+password form |
| `/register` | `src/app/register/page.tsx` | Client, multi-role registration |
| `/dashboard` | `src/app/dashboard/page.tsx` | Client, protected |
| `/demands/new` | `src/app/demands/new/page.tsx` | Client, lazy-loads `SplitDemandView` (AI dual-pane) |
| `/demands/create` | `src/app/demands/create/page.tsx` | Client, traditional form |
| `/demands/[id]` | `src/app/demands/[id]/page.tsx` | Client |
| `/orders/[id]` | `src/app/orders/[id]/page.tsx` | Client |
| `/payment/[id]` | `src/app/payment/[id]/page.tsx` | Client |
| `/provider/incoming` | `src/app/provider/incoming/page.tsx` | Hybrid (server data fetch + client list) |
| `/admin/*` | `src/app/admin/*` | Client, admin-only proxy guard |
| `/offline` | `src/app/offline/page.tsx` | Static, PWA fallback |

### API Routes (key)

| Route | File | Auth |
|-------|------|------|
| `POST /api/register` | `src/app/api/register/route.ts` | None (anon), uses service_role fallback |
| `GET|PATCH /api/profile` | `src/app/api/profile/route.ts` | `withAuth` |
| `POST /api/webhooks/stripe` | `src/app/api/webhooks/stripe/route.ts` | Stripe signature only |
| `POST /api/payment/create` | `src/app/api/payment/create/route.ts` | `withAuth` |
| `POST /api/demands/create` | `src/app/api/demands/create/route.ts` | `withAuth` |
| `GET /api/demands` | `src/app/api/demands/route.ts` | `withAuth` |

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `SessionProvider` | `src/components/SessionProvider.tsx` | Auth context for entire app |
| `Header` | `src/components/Header.tsx` | Nav bar, role-based nav items, auth buttons, sign out |
| `SplitDemandView` | `src/components/SplitDemandView.tsx` | AI dual-pane demand creation (chat → protocol → broadcast) |
| `NotificationBell` | `src/components/NotificationBell.tsx` | Live notification unread count |
| `UXProvider` | `src/components/providers/UXProvider.tsx` | Theme/toast context |

### Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Serwist SW injection, standalone output |
| `tsconfig.json` | Strict, `@/*` → `./src/*`, skipLibCheck |
| `tailwind.config.ts` | (none at root — Tailwind v4 via `@tailwindcss/postcss` in globals.css) |
| `public/sw.js` | Serwist-generated Service Worker (~65KB) |
| `public/manifest.webmanifest` | PWA manifest (192/512 icons, standalone) |
| `DEVELOPMENT_LOG.md` | Architecture diary, RLS audit log, AI prompt kit, pre-flight checklist |
| `AI_HANDOFF.md` | **This file** |

---

## 3. Major Architecture Changes & Pitfalls

### 3.1 Supabase SSR Cookie Sync & proxy.ts Rewrite

**THIS IS THE MOST CRITICAL SECTION. DO NOT REGRESS.**

#### What happened

The project had a `proxy.ts` (Next.js 16 middleware replacement) that **manually parsed** the Supabase auth cookie to check login state:

```typescript
// OLD — DO NOT REVERT TO THIS
function getRoleFromCookie(cookieValue: string): string | null {
  const raw = decodeURIComponent(cookieValue)
  const b64 = raw.replace(/^base64-/, '')
  const json = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))
  const token = json.access_token
  // ...
}
```

**Three problems:**
1. **Token never refreshed** — `createServerClient` wasn't used, so `supabase.auth.getUser()` in API routes always called with potentially expired tokens → 401 errors after ~1 hour
2. **No cookie sync** — After login, `signInWithPassword` set cookies via browser client, but the proxy never re-ran `getUser()` to refresh them. Server components couldn't authenticate.
3. **Two deprecated imports** — `api-auth.ts` and `supabase-route-client.ts` both imported `createServerClient` from `@supabase/auth-helpers-nextjs` (deprecated). Functionally similar to `@supabase/ssr`'s version, but risky.

#### The fix (commit `fc40a0f`)

```typescript
// NEW — DO NOT TOUCH THIS PATTERN
// src/proxy.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Route protection for non-public paths
  if (!user && isProtectedRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return supabaseResponse
}
```

**Key principles (MUST PRESERVE):**
1. `createServerClient` from `@supabase/ssr` — never the deprecated `auth-helpers-nextjs`
2. Proxy calls `supabase.auth.getUser()` on **every request** — this refreshes the auth token cookie
3. `setAll` callback **must** update both `request.cookies` and `supabaseResponse.cookies` — without both, the refreshed cookie doesn't propagate
4. Full type annotations for `cookiesToSet` — `@supabase/ssr` needs explicit types in strict mode

#### Login redirect fix

```typescript
// OLD — didn't work because it was client-side only
router.refresh()
router.push("/dashboard")  // ❌ proxy never runs, cookie not synced

// NEW — full page navigation triggers proxy
window.location.href = "/dashboard"  // ✅ proxy runs, token refreshed, cookies synced
```

#### SignOut fix

```typescript
// OLD — used getSupabase() (server client, persistSession:false, never clears cookies)
getSupabase().auth.signOut()  // ❌ user stays logged in

// NEW — uses browser client with cookie persistence
const supabase = getBrowserSupabase()
await supabase.auth.signOut()
window.location.href = "/"  // ✅ full redirect clears everything
```

### 3.2 Email-Based Admin RLS → RBAC Migration

**Trigger:** Pre-flight audit discovered 5 RLS policies using `%@admin.com` email matching.

**Fix:** Created `20260723_fix_admin_rls_rbac.sql` — drops 5 policies, recreates using `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')`.

**Tables affected:** `demands`, `profiles`, `notifications`, `provider_wallets`, `wallet_logs`.

**ALSO FIXED:** `users.role` CHECK constraint lacked `'admin'` — DROP/ADD added it.

**DO NOT REINTRODUCE** any pattern matching `LIKE '%@admin.com'` in RLS.

### 3.3 Stripe Webhook Idempotency

**Risk:** Stripe retries would insert duplicate `payments` rows. `checkout.session.completed` + `payment_intent.succeeded` fire for the same payment.

**Defense layers (in `src/app/api/webhooks/stripe/route.ts`):**
1. `provider_payment_id` exists-check → early return if duplicate
2. Only handle `payment_intent.succeeded` — `checkout.session.completed` branch removed
3. `STRIPE_WEBHOOK_SECRET` existence check at route entry (was `!`)
4. Generic error message on sig failure (no Stripe leak)

### 3.4 Known Technical Debt (DO NOT TOUCH WITHOUT PLAN)

| Debt | Impact | File(s) |
|------|--------|---------|
| `demands` table has NO CREATE TABLE migration | Tests assume it exists | Missing DDL |
| `contracts` table has NO CREATE TABLE + NO RLS | FK references to it fail silently | Missing DDL |
| 6 tables with NO RLS (`category_configs`, `provider_qualifications`, `credit_events`, `guarantee_links`, `precedents`, `bandit_stats`) | Unauthenticated access possible | migration files |
| `profiles.role` values are MIXED case ('ADMIN' vs 'admin') | `015_notifications_system.sql` uses `'ADMIN'`; RBAC fix uses `'admin'` | inconsistent conventions |
| 1 pre-existing test failure: `e2e-integration.test.ts` | `isColdStart` mock export issue | `tests/e2e-integration.test.ts` |
| `typescript.ignoreBuildErrors: true` in `next.config.ts` | Hides type errors at build time | `next.config.ts` (intentional for now) |

---

## 4. Core Business Flows & Data Contracts

### 4.1 Authentication Flow

```
User → [/login] → signInWithPassword(email, password)
  ├─ ✅ Success → set cookies (browser client via @supabase/ssr)
  │               → window.location.href = "/dashboard"
  │               → proxy.ts runs on full page load:
  │                   ├─ createServerClient reads cookies
  │                   ├─ supabase.auth.getUser() refreshes token
  │                   ├─ setAll() writes refreshed cookie to response
  │                   └─ Route allowed (user exists)
  │               → dashboard page server components read session
  │
  └─ ❌ Failure → show error message (Chinese locale)

User → [/register] → POST /api/register (body: {name, email, password, phone, roles})
  ├─ service_role client creates auth user (with rate-limit fallback to Admin API)
  ├─ INSERT into profiles table
  └─ Redirect to /login?registered=true

User → [/logout] → Header signOut button
  ├─ getBrowserSupabase().auth.signOut()
  └─ window.location.href = "/"
```

### 4.2 Demand Creation & Matching Flow

```
User clicks "发布需求" → /demands/new (if logged in, else proxy redirects to /login)

Two paths:

[A] SplitDemandView (AI dual-pane — recommended UX)
  ├─ Left pane: protocol canvas (real-time AI-extracted structured data)
  ├─ Right pane: chat interface (useChat hook → /api/chat)
  ├─ AI detects intent → emits [PROTOCOL_JSON] marker
  ├─ User confirms → POST /api/demands/create
  └─ Response → broadcast to matching grid

[B] Traditional form — /demands/create
  ├─ Title + Budget + Description → POST /api/demands/create
  └─ Redirects to /demands

POST /api/demands/create (withAuth)
  ├─ Decode JWT → get user.id
  ├─ INSERT INTO demands (demander_id = user.id, status = 'PENDING')
  ├─ Trigger AI matching engine (async)
  └─ Return demand ID → client redirects to /demands/[id]
```

### 4.3 Stripe Payment & Escrow Flow

```
Order created → user clicks "Pay with Stripe"

[Client] POST /api/payment/create (withAuth)
  ├─ Create contract record (status: pending_held)
  ├─ StripeProvider.createPayment() → PaymentIntent
  └─ Return client_secret → client mounts Stripe Elements

[Client] stripe.confirmCardPayment(client_secret)
  ├─ Stripe processes payment
  └─ Redirect to /payment/[id] after completion

[Stripe] → POST /api/webhooks/stripe (server-to-server)
  ├─ Verify signature (STRIPE_WEBHOOK_SECRET)
  ├─ Handle payment_intent.succeeded:
  │   ├─ Check provider_payment_id uniqueness (idempotency)
  │   ├─ UPDATE contracts fund_status = 'HELD'
  │   ├─ INSERT INTO payments (status: 'SUCCEEDED')
  │   ├─ INSERT INTO notifications (customer + provider)
  │   ├─ INSERT INTO contract_events (state machine log)
  │   └─ emitEvent('order', 'pay', ...)
  └─ Handle payment_intent.payment_failed:
      ├─ Idempotency check
      ├─ INSERT INTO payments (status: 'FAILED')
      └─ Notify user

[Escrow state machine] — src/modules/m13-payment/payment-service.ts
  PENDING_HELD → HELD → COMPLETED → SATISFACTION_HELD → SETTLED
                ↘ DISPUTED ↗              ↗ CANCELLED

6 funding modes: full_prepay, deposit_only, commitment, milestone_staged, split_revenue, pay_later
3 arbitration tiers: Green (≤¥200 auto), Yellow, Red (injury + large amount)
```

---

## 5. Current Breakpoints & Next Steps

### Current Status

The platform is **functionally complete** for a v1.0.0 release. The core flows (auth, demand creation, payment, dispute) all work in unit tests. However, the **full end-to-end Stripe payment + webhook flow has NOT been manually verified** against a production Stripe account.

### Blockers

1. **E2E Stripe verification requires live keys** — `STRIPE_SECRET_KEY` (sk_live_*) and `STRIPE_WEBHOOK_SECRET` (whsec_*) must be pasted from Stripe Dashboard. The current `.env.local` has placeholder values.
2. **Supabase migration not auto-executed** — The final migration `20260723_fix_admin_rls_rbac.sql` must be manually run in Supabase SQL Editor.
3. **No production credentials** — Alipay, WeChat Pay, Redis push, SMS, real-name verification all have placeholder/env vars.

### First Commands for Next Engineer

```bash
cd D:\Users\Administrator\Desktop\deal-protocol

# 1. Read the context
cat AI_HANDOFF.md    # this file
cat DEVELOPMENT_LOG.md

# 2. Run verification
npx tsc --noEmit

# 3. Run unit tests
npm test

# 4. Run build
npm run build

# 5. Smoke test (requires Stripe keys + Vercel deployment)
npm run test:smoke   # Playwright against production URL
```

### First Testing Actions

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create a `.env.local` with real Stripe test keys | Webhook handler can `constructEvent` |
| 2 | Run `npm run dev`, register a user | User created in Supabase Auth + profiles |
| 3 | Log in at `/login` | Redirect to `/dashboard`, session persists across refresh |
| 4 | Click "发布需求" → create a demand via chat | `SplitDemandView` renders, POST succeeds |
| 5 | Create a Stripe PaymentIntent → trigger webhook | Webhook POST returns 200, payments table populated |

### If Everything Works

1. Push to master → Vercel auto-deploys
2. Update Stripe webhook endpoint URL to production domain
3. Confirm all env vars in Vercel Dashboard match `.env.example`
4. Run `npm run test:smoke` against production
5. Verify `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/opengraph-image` return 200

### Unresolved Architecture Decisions

| Question | Options | Impact |
|----------|---------|--------|
| `contracts` table missing DDL + RLS | Either create migration or refactor to use `orders` table | FK constraints fail silently |
| `demands` table missing DDL | Write CREATE TABLE migration | Existing DB has it, new envs won't |
| Mixed case `profiles.role` ('ADMIN' vs 'admin') | Normalize to one convention | RLS comparison may fail |
| `typescript.ignoreBuildErrors: true` in next.config | Remove after fixing all strict TS errors | Build time safety |

---

*End of AI_HANDOFF. Reference `DEVELOPMENT_LOG.md` for deeper audit trails and AI prompt templates.*
