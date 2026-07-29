# Deal Protocol — Project State Assessment

> Generated: 2026-07-29  
> Purpose: Architecture review & handoff to LLM architect

---

## 1. Project Directory Tree

```
deal-protocol/                          # Root — Next.js monolith
├── .cursorrules
├── .env / .env.example / .env.local    # Environment configuration
├── .github/                            # GitHub workflows
├── .vercel/                            # Vercel deployment config
├── AGENTS.md                           # Agent behavior rules
├── AI_HANDOFF.md                       # AI handoff docs
├── ARCHITECTURE.md / CLAUDE.md         # Architecture docs
├── DEVELOPMENT_LOG.md / SESSION_LOG_*  # Development logs
├── AUDIT_REPORT_FULL_STACK.md          # Security/architecture audits
├── DESIGN_PLAN_ALIGNMENT_REPORT.md
├── PLATFORM_WHITE_PAPER.md
├── UI_UX_ARCHITECTURE_AUDIT.md
│
├── docker-compose.yml                  # Local dev: web + postgres
├── Dockerfile                          # Container build
├── nginx.conf                          # Reverse proxy config
├── entrypoint.sh / install.ps1 / setup.ps1
│
├── next.config.ts                      # Next.js 16 + Serwist (PWA)
├── vercel.json                         # Vercel deployment + cron jobs
├── tsconfig.json                       # TypeScript config (paths: @/*)
├── vitest.config.ts                    # Vitest unit test config
├── playwright.config.ts                # Playwright E2E config
├── postcss.config.mjs / components.json
│
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Home page
│   │   ├── globals.css
│   │   ├── sw.ts                       # Service Worker (PWA)
│   │   ├── manifest.ts / robots.ts / sitemap.ts
│   │   │
│   │   ├── admin/                      # Admin panel (dashboard, config, disputes, complaints, review, protocols, reputation, withdrawals)
│   │   ├── api/                        # API routes (see §4)
│   │   ├── chat/[id]/                  # Real-time chat
│   │   ├── client/orders/[id]/         # Client order tracking
│   │   ├── console/                    # User console
│   │   ├── dashboard/                  # User dashboard
│   │   ├── demands/                    # Demand listing & creation
│   │   ├── demo/                       # Demo page
│   │   ├── developer/radar/            # Developer AI radar
│   │   ├── disputes/                   # Dispute management
│   │   ├── evidence/[id]/              # Evidence chain viewer
│   │   ├── finance/                    # Finance dashboard
│   │   ├── landing/                    # Marketing landing
│   │   ├── login/                      # Login page
│   │   ├── offline/                    # PWA offline fallback
│   │   ├── orders/                     # Order management
│   │   ├── payment/[id]/               # Payment page
│   │   ├── profile/                    # User profile
│   │   ├── provider/                   # Provider console, grab, orders, incoming
│   │   ├── register/                   # Registration
│   │   ├── rights/                     # User rights page
│   │   ├── sos/                        # SOS emergency
│   │   ├── team/                       # Team formation
│   │   ├── user/[id]/                  # Public user profile
│   │   └── verification/              # Identity verification
│   │
│   ├── components/                     # Reusable UI components
│   │   ├── ui/                         # Base UI kit
│   │   ├── providers/                  # React providers
│   │   └── *.tsx                       # 25+ domain components
│   │
│   ├── hooks/                          # Custom React hooks
│   │   ├── use-finance-realtime.ts
│   │   ├── use-order-realtime.ts
│   │   ├── use-supabase-session.ts
│   │   ├── useFulfillmentMutation.ts
│   │   └── useSupabaseRealtime.ts
│   │
│   ├── lib/                            # Core libraries (67 files)
│   │   ├── supabase-client.ts          # Server-side Supabase client
│   │   ├── supabase-browser.ts         # Browser Supabase client
│   │   ├── supabase-route-client.ts    # API route client
│   │   ├── supabase-mock.ts            # Test mock
│   │   ├── auth.ts                     # Auth cookie parsing
│   │   ├── api-auth.ts                 # API auth middleware
│   │   ├── payment.ts                  # Multi-channel payment abstraction (Stripe/Alipay/WeChat)
│   │   ├── milestone-escrow.ts         # Staged escrow
│   │   │
│   │   ├── ai-provider.ts              # AI model selector (DeepSeek/Gemini/Mock)
│   │   ├── ai-arbitrator.ts            # AI arbitration + evidence export
│   │   ├── ai-negotiator.ts            # AI price negotiation
│   │   ├── vision-inspector.ts         # Vision AI quality inspection
│   │   ├── intent-radar.ts             # AI repurchase prediction
│   │   ├── llm-adapter.ts / llm.ts     # LLM wrapper
│   │   ├── concierge-agent.ts          # AI concierge chat
│   │   ├── agent-gateway.ts            # A2A agent gateway
│   │   │
│   │   ├── contract-machine.ts         # State machine
│   │   ├── contract/                   # Commission, events, penalty, refund, satisfaction
│   │   ├── contracts.ts
│   │   ├── protocol/                   # Protocol engine
│   │   ├── contract-builder.ts
│   │   │
│   │   ├── fraud-detection.ts          # Circular transaction detection
│   │   ├── sla-enforcer.ts             # SLA enforcement engine
│   │   ├── peer-jury.ts               # Community jury system
│   │   ├── workflow-evidence-tracker.ts # On-site evidence chain
│   │   │
│   │   ├── matching/                   # Matching engine
│   │   ├── semantic-matcher.ts
│   │   ├── risk-interceptor.ts
│   │   ├── rate-limit.ts
│   │   ├── feature-flags.ts
│   │   ├── event-bus.ts
│   │   ├── pii-encrypt.ts
│   │   ├── privacy-guard.ts
│   │   ├── notification-ladder.ts
│   │   ├── referral-service.ts
│   │   ├── genui-renderer.tsx
│   │   └── ... (67 files total)
│   │
│   ├── modules/                        # Domain modules (modular monolith)
│   │   ├── m02-auth/                   # Identity verification
│   │   ├── m03-category-config/        # Category loader + pricing engine
│   │   ├── m04-protocol-generation/    # Protocol generator
│   │   ├── m05-geo-index/             # Geo spatial service
│   │   ├── m06-matching-routing/      # Demand-provider matcher
│   │   ├── m07-credit/                # Credit scoring engine
│   │   ├── m08-bandit/                # Multi-armed bandit ranker
│   │   ├── m09-content-audit/         # Content audit
│   │   ├── m10-sos/                   # SOS emergency service
│   │   ├── m11-evidence-log/          # Evidence chain
│   │   ├── m12-push/                  # Push notification service
│   │   ├── m13-payment/               # Payment processing
│   │   ├── m14-team-formation/        # Team formation
│   │   └── mM02-mM13/                 # Mirror modules (empty — placeholders)
│   │
│   ├── types/                          # (empty — types inline)
│   ├── generated/                      # Generated code
│   └── instrumentation.ts / proxy.ts   # Server instrumentation
│
├── supabase/
│   ├── migrations/                     # 35 migration files (001–018 + patches)
│   ├── config.toml                     # (missing — not tracked)
│   └── *.sql                           # Ad-hoc SQL scripts
│
├── tests/                              # 42 Vitest unit tests
├── e2e/                                # 4 Playwright E2E tests
├── scripts/                            # Utility scripts
├── packages/                           # Internal packages
│   ├── credit-formula/
│   └── payment-core/
│
├── public/                             # Static assets + PWA icons
├── docs/                               # Documentation
├── mobile/                             # Mobile app (separate)
└── .next/ / node_modules/              # Build artifacts (excluded)
```

---

## 2. Technology Stack & Dependencies

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Next.js | ^16.0.0 |
| **Runtime** | Node.js | >=22.0.0 |
| **Language** | TypeScript | ^5.8.0 |
| **Styling** | Tailwind CSS v4 + PostCSS | ^4.3.2 |
| **UI Components** | @base-ui/react | ^1.6.0 |
| **Animation** | Framer Motion | ^12.42.2 |
| **Icons** | Lucide React | ^1.23.0 |
| **Map** | Leaflet + react-leaflet | ^1.9.4 / ^5.0.0 |
| **State** | Zustand | ^5.0.0 |
| **Form/Schema** | Zod | ^3.24.0 |
| **Classnames** | clsx + tailwind-merge + cva | |
| **Date** | date-fns | ^4.1.0 |
| **Toast** | react-hot-toast | ^2.6.0 |
| **Error Boundary** | react-error-boundary | ^6.1.2 |
| **ID Generation** | nanoid | ^5.1.0 |
| **PWA** | @serwist/next | ^9.5.11 |

### Backend & Database

| Category | Technology | Version |
|----------|-----------|---------|
| **Database** | PostgreSQL 15 (Supabase) | — |
| **ORM/Client** | @supabase/supabase-js | ^2.49.0 |
| **Auth** | @supabase/ssr + @supabase/auth-helpers-nextjs | ^0.6.1 / ^0.15.0 |
| **Extensions** | pgvector (AI embeddings), PostGIS (geospatial) | — |
| **Server DB** | pg (node-postgres) | ^8.22.0 |

### AI / LLM

| Category | Technology | Version |
|----------|-----------|---------|
| **AI SDK** | ai (Vercel AI SDK) | ^7.0.18 |
| **Google AI** | @ai-sdk/google | ^4.0.9 |
| **OpenAI Compatible** | @ai-sdk/openai-compatible | ^3.0.6 |
| **React AI** | @ai-sdk/react | ^4.0.19 |
| **Default Model** | DeepSeek Chat (deepseek-chat) | — |
| **Fallback Model** | Google Gemini 1.5 Flash | — |

### Payment

| Category | Technology |
|----------|-----------|
| **Stripe** | stripe (^22.3.0) |
| **Alipay** | Custom integration via @daviekong/payment-core |
| **WeChat Pay** | Custom integration via @daviekong/payment-core |

### Dev / Testing

| Category | Technology | Version |
|----------|-----------|---------|
| **Unit Test** | Vitest | ^3.1.0 |
| **E2E Test** | Playwright | ^1.61.1 |
| **Linter** | ESLint | ^9.0.0 |
| **Formatter** | Prettier | ^3.5.0 |
| **TypeScript Runner** | tsx | ^4.23.0 |
| **Obfuscation** | webpack-obfuscator | ^3.6.1 |

---

## 3. Data Architecture

### 3.1 Database: Supabase PostgreSQL (28 tables)

#### Core Identity
| Table | Purpose | Key Columns | RLS |
|-------|---------|-------------|-----|
| `profiles` | Active user profile (extends auth.users) | id, name, phone, role, balance, credit_score, trust_tier, verification_*, reputation_score, compliance_status, is_agent, provider_stake_status, referrer_id | Self-read, self-update, admin all |
| `users` | Legacy user table | id, phone, role, current_location, identity_verified, deleted_at | Self only |

#### Service Categories
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `category_configs` | Service category definitions | category, risk_tier, schema_json, response_mode, enabled |
| `pricing_configs` | Pricing rules per category | category, min_price, default_work_hours, warranty_months |

#### Core Business
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `protocols` | Deal/service agreements | id, demander_id, provider_id, category, status (draft→settled), final_price, embedding (1024d), location (GEOGRAPHY) |
| `demands` | Service demand listings | id, demander_id, title, budget, status, embedding (1536d) |
| `contracts` | Formal contracts from demands | id, demand_id, customer_id, provider_id, amount, fund_status, tip_amount, contract_doc_markdown/hash |
| `orders` | Transaction records | id, protocol_id, provider_id, status, service_phase, escrow_status, fund_status |

#### Payments & Finance
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `provider_wallets` | Provider wallet balances | provider_id, balance, deposit_amount, is_staked |
| `wallet_logs` | Wallet transaction audit | provider_id, amount, type, order_id |
| `withdrawal_requests` | Provider withdrawal requests | provider_id, amount, channel, status |
| `milestone_schedules` | Multi-installment staged escrow | contract_id, title, amount, step_number, status |

#### Disputes & Arbitration
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `order_disputes` | Dispute records | order_id, initiator_id, reason, status (pending/refunded/force_settled) |
| `precedents` | Arbitration case law | summary, key_factors, ruling_principle, embedding (1536d) |
| `jury_votes` | Community jury voting | dispute_id, juror_id, vote, reason |

#### Evidence & Credit
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `evidence_log` | Append-only SHA-256 evidence chain | protocol_id, event_type, payload, hash, prev_hash |
| `credit_records` | 6-dimension credit scores | user_id, base_score, integrity/capability/reliability/communication/safety/contribution scores |
| `credit_events` | Credit score change audit | user_id, dimension, delta, reason, evidence_id, sentiment, fulfillment_snapshot |

#### Support
| Table | Purpose |
|-------|---------|
| `provider_qualifications` | Provider certifications per category |
| `provider_categories` | Provider service categories & online status |
| `guarantee_links` | Guarantee/endorsement network |
| `team_requests` | Team formation — sub-contractor recruitment |
| `bandit_stats` | Multi-armed bandit dispatch stats |
| `notifications` | In-app notification system |
| `order_reviews` | Bilateral fulfillment reviews |
| `developer_profiles` | Developer AI matching profiles |
| `admin_tasks` | Manual admin assignment fallback |
| `insurance_pool` | Insurance pool (1% per-order) |
| `llm_logs` | LLM call audit log |

### 3.2 Extensions
- **pgvector** — cosine similarity search on 1024d/1536d embeddings
- **PostGIS** — ST_DWithin / ST_Distance spatial queries

### 3.3 Key Indexes (21 total)
- GIST indexes on geography columns (location-based search)
- IVFFLAT indexes on embedding columns (AI matching)
- BTREE indexes on foreign keys and lookup columns

### 3.4 Key Functions (9)
| Function | Purpose |
|----------|---------|
| `create_user_direct()` | Bypass rate-limit — inserts user + identity + profile atomically |
| `match_providers_nearby()` | Spatial search for online providers within radius |
| `grab_demand()` | Atomic grab-order with FOR UPDATE lock |
| `submit_withdrawal_request()` | Atomic withdrawal with balance check |
| `match_demands_hybrid()` | Hybrid AI matching (60% vector + 30% reputation + 10% budget) |
| `detect_circular_transactions()` | Recursive fraud detection (max depth 5) |
| `update_trust_tier()` | Maps base_score → trust_tier 1-5 |
| `process_review_reputation_trigger()` | Review → reputation recalculation |
| `init_provider_wallet()` | Auto-create wallet on verification approval |

### 3.5 Key Triggers (3)
| Trigger | Event | Action |
|---------|-------|--------|
| `trg_init_provider_wallet` | profiles verification approved | Create wallet |
| `after_review_inserted` | order_reviews INSERT | Recalculate reputation |
| `trg_credit_update_trust_tier` | credit_records base_score change | Update trust_tier |

### 3.6 Realtime CDC (6 tables)
`orders`, `profiles`, `provider_wallets`, `demands`, `withdrawal_requests`, `notifications` — published to `supabase_realtime`

### 3.7 RLS Summary
- **21 tables** with RLS enabled
- Pattern: self-only access, public authenticated read, admin full access, append-only (evidence_log), system-only mutations (credit_records)
- Database role `bandit_reader` explicitly isolated from credit data

### 3.8 Data Flow
```
User → Auth (Supabase) → Create Demand (protocols) → AI Classification → 
  → Matching (hybrid: vector + reputation + budget) → 
  → Contract (contracts) → Escrow (milestone_schedules) → 
  → Fulfillment (orders/service_phase) → Evidence Log (evidence_log) → 
  → Review → Credit Update → Wallet Settlement
```

---

## 4. Service Integration Points

### 4.1 Supabase (32 API route files interact)
| Aspect | Implementation |
|--------|---------------|
| **Auth** | `src/lib/auth.ts` — cookie-based session parsing; `src/lib/supabase-client.ts` — server client; `src/lib/supabase-browser.ts` — browser client |
| **DB Client** | `getSupabase()` (anon) + `getServiceClient()` (service_role) in `src/lib/supabase-client.ts` |
| **Admin API bypass** | `create_user_direct()` SECURITY DEFINER function for rate-limit bypass |
| **Realtime** | Hooks in `src/hooks/use-order-realtime.ts`, `use-finance-realtime.ts`, `useSupabaseRealtime.ts` |
| **Storage** | No explicit storage config found (likely unused) |

### 4.2 Vercel
| Aspect | Detail |
|--------|--------|
| **Deployment** | `vercel.json` — framework nextjs, build command `npm run build`, security headers |
| **Cron Jobs** | 2 crons: `/api/cron/check-timeouts` (daily midnight), `/api/cron/resolve-disputes` (daily 6am) |
| **API Routes** | 34 route groups under `src/app/api/` — deployed as Serverless Functions |
| **Site URL** | `https://deal-protocol-phi.vercel.app` |

### 4.3 Payment Systems

| Channel | Integration | Key Files |
|---------|------------|-----------|
| **Stripe** | stripe SDK + webhooks | `src/lib/payment.ts` (StripeProvider), `src/app/api/webhooks/stripe/route.ts`, `src/app/api/payment/create/route.ts` |
| **Alipay** | Custom RSA-SHA256 signing | `src/lib/alipay-service.ts`, `src/app/api/webhooks/alipay/route.ts`, `src/app/api/payment/notify/route.ts` |
| **WeChat Pay** | Custom MD5 + XML | `src/lib/wechat-pay-service.ts`, `src/app/api/webhooks/wechat/route.ts`, `src/app/api/payment/create/route.ts` |
| **Mock** | Direct state transition (dev) | `src/lib/payment.ts` |

All three webhooks follow: **validate → dedup → update contract fund_status=HELD → insert payment record → send notifications → emit event-bus event**.

### 4.4 AI / LLM Providers
| Provider | Model | When Used |
|----------|-------|-----------|
| **DeepSeek** (default) | deepseek-chat | AI_PROVIDER=deepseek or DEEPSEEK_API_KEY set |
| **Google Gemini** | gemini-1.5-flash | GEMINI_API_KEY set (fallback) |
| **Mock** | mock-* | Placeholder keys during development |

AI-powered features:
- Protocol generation (`/api/demands`)
- Price negotiation (`/api/ai/negotiate`)
- Arbitration (`/api/disputes/[id]/arbitrate-ai`)
- Quality inspection (`/api/ai/inspect-quality`)
- Intent prediction (`/api/demands/predict-intent`)
- Speech-to-text (`/api/ai/asr`)
- Concierge chat (`/api/chat`)
- Text classification (`/api/llm-classify`)

---

## 5. Core Features & Status

### 5.1 Authentication & User Management
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| SMS Auth (phone + code) | ✅ Complete | `/api/auth/sms/send`, `/api/auth/sms/verify` |
| WeChat OAuth | ✅ Complete | `/api/auth/wechat`, `/api/auth/wechat/callback` |
| Registration | ✅ Complete | `/api/register` |
| Profile CRUD | ✅ Complete | `/api/profile` |
| Identity Verification | ✅ Complete | `/api/verify/identity`, `/api/verification/submit` |
| Account Deletion (soft) | ✅ Complete | `/api/profile/delete` |

### 5.2 Demand & Order Flow
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| Demand creation (AI classifier) | ✅ Complete | `/api/demands` (POST) |
| Demand listing & nearby search | ✅ Complete | `/api/demands`, `/api/demands/nearby` |
| Protocol generation (NL→JSON) | ✅ Complete | `/api/protocols/generate` |
| Matching & assignment | ✅ Complete | `/api/demands/[id]/match`, `/api/demands/[id]/assign` |
| Tip / priority boosting | ✅ Complete | `/api/demands/[id]/tip` |
| Order state machine | ✅ Complete | `/api/orders/[id]` (PATCH) |
| Delivery & acceptance | ✅ Complete | `/api/orders/submit-delivery`, `/api/orders/accept-delivery` |
| Satisfaction hold | ✅ Complete | satisfaction.ts |

### 5.3 Payment & Finance
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| Multi-channel payment creation | ✅ Complete | `/api/payment/create` |
| Escrow release | ✅ Complete | `/api/payment/release` |
| Stripe webhook | ✅ Complete | `/api/webhooks/stripe` |
| Alipay webhook | ✅ Complete | `/api/webhooks/alipay` |
| WeChat Pay webhook | ✅ Complete | `/api/webhooks/wechat` |
| Milestone/staged escrow | ✅ Complete | `milestone-escrow.ts` |
| Provider withdrawal | ✅ Complete | `/api/provider/withdraw`, `/api/finance/withdraw` |
| Finance overview | ✅ Complete | `/api/finance/overview`, `/api/finance/transactions` |

### 5.4 AI Features
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| Hybrid AI matching (vector + reputation + budget) | ✅ Complete | `/api/ai/match` |
| AI price negotiation | ✅ Complete | `/api/ai/negotiate` |
| AI arbitration | ✅ Complete | `/api/disputes/[id]/arbitrate-ai` |
| Vision quality inspection | ✅ Complete | `/api/ai/inspect-quality` |
| Speech-to-text protocol extraction | ✅ Complete | `/api/ai/asr` |
| Intent prediction + repurchase | ✅ Complete | `/api/demands/predict-intent` |
| AI concierge chat | ✅ Complete | `/api/chat` |
| LLM text classification | ✅ Complete | `/api/llm-classify` |
| A2A agent gateway (2027) | ✅ Complete | `/api/v1/agent/protocols/bid` |

### 5.5 Disputes & Reputation
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| Dispute creation & resolution | ✅ Complete | `/api/disputes/create`, `/api/disputes/resolve` |
| AI arbitration report | ✅ Complete | `/api/disputes/[id]/arbitrate-ai` |
| Peer jury voting | ✅ Complete | `peer-jury.ts` |
| Credit scoring (6 dimensions) | ✅ Complete | `credit-engine.ts` |
| Reputation auto-calculation | ✅ Complete | trigger on order_reviews |
| Compliance system (WARN/SUSPEND/BAN) | ✅ Complete | `process_review_reputation_trigger()` |
| Admin arbitration | ✅ Complete | `/api/admin/arbitrate` |

### 5.6 Evidence & SLA
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| SHA-256 append-only evidence chain | ✅ Complete | `evidence-log/` |
| On-site workflow evidence tracking | ✅ Complete | `workflow-evidence-tracker.ts` |
| Judicial evidence package export | ✅ Complete | `/api/evidence/export-judicial-package` |
| SLA enforcement engine | ✅ Complete | `sla-enforcer.ts` |
| Fraud detection | ✅ Complete | `fraud-detection.ts` |

### 5.7 Team Formation
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| Team protocol creation | ✅ Complete | `/api/team/create` |
| Interest expression | ✅ Complete | `/api/team/interest` |
| GenUI renderer | ✅ Complete | `src/lib/genui-renderer.tsx` |

### 5.8 Admin
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| Dashboard stats | ✅ Complete | `/api/admin/stats` |
| Review queue | ✅ Complete | `/api/admin/review` |
| Platform config editor | ✅ Complete | `/api/admin/config` |
| Withdrawal review | ✅ Complete | `/api/admin/withdraw/review` |
| Complaint management | ✅ Complete | `/api/admin/complaints` |
| Reputation amnesty | ✅ Complete | `/api/admin/reputation/amnesty` |
| Cron: auto-complete timeouts | ✅ Complete | `/api/cron/check-timeouts` |
| Cron: auto-resolve disputes | ✅ Complete | `/api/cron/resolve-disputes` |
| Cron: credit decay | ✅ Complete | `/api/cron/credit-decay` |

### 5.9 Communication
| Feature | Status | API Endpoint |
|---------|--------|-------------|
| Real-time chat | ✅ Complete | `/api/chat`, SSE via `/api/sse` |
| Push notifications | ✅ Complete | `/api/notifications` |
| SOS emergency alerts | ✅ Complete | `/api/sos/trigger` |
| Privacy number (telecom) | ✅ Complete | `/api/telecom/privacy-number` |

---

## 6. Testing & Environment Variables

### 6.1 Test Files

#### Unit Tests (Vitest) — 42 files in `tests/`
| Test File | Coverage Area |
|-----------|---------------|
| `m02-auth.test.ts` | Authentication flows |
| `m03-category-config.test.ts` | Category configuration |
| `m04-protocol-gen.test.ts` | Protocol generation |
| `m05-geo.test.ts` | Geo-spatial search |
| `m06-matching.test.ts` | Matching engine |
| `m07-credit.test.ts`, `m07-cross-category.test.ts` | Credit scoring |
| `m08-bandit.test.ts` | Bandit ranking |
| `m09-audit.test.ts`, `m09-flydan.test.ts` | Content audit |
| `m10-sos.test.ts`, `m10-sos-routing.test.ts` | SOS emergency |
| `m11-evidence-chain.test.ts` | Evidence chain |
| `m12-push.test.ts`, `m12-concurrent-grab.test.ts` | Push + concurrency |
| `m13-payment.test.ts` | Payment processing |
| `m14-team-formation.test.ts`, `m14-genui-renderer.test.tsx` | Team formation |
| `m15-feature-flags.test.ts` | Feature flags |
| `sms-auth.test.ts` | SMS authentication |
| `stripe-webhook.test.ts` | Stripe webhook |
| `alipay-payment.test.ts`, `wechat-integration.test.ts` | Payment channel tests |
| `ai-arbitrator-legal.test.ts`, `llm-integration.test.ts` | AI/LLM tests |
| `deepseek-ai.test.ts`, `dimension3-ai.test.ts` | AI model tests |
| `dynamic-pricing-multimodal.test.ts` | Dynamic pricing |
| `global-mechanisms.test.ts` | Cross-module mechanisms |
| `black-tech-2027.test.ts`, `frontier-2026.test.ts` | Future tech |
| `frontier-upgrades-2026.test.ts` | Upgrade validation |
| `e2e-integration.test.ts` | Full integration |
| `workflow-evidence.test.ts` | Workflow evidence |
| `world-class-fusion.test.ts` | World-class mechanisms |
| `realtime-chat.test.ts` | Real-time chat |
| `provider-checkin.test.ts` | Provider check-in |
| `p0-architecture-fixes.test.ts`, `p0-deviations.test.ts` | Architecture audits |
| `p1-gaps.test.ts` | Gap analysis |
| `ui-ux-remediation.test.tsx` | UI/UX remediation |

#### E2E Tests (Playwright) — 4 files in `e2e/`
| Test File | Coverage Area |
|-----------|---------------|
| `full-flow.spec.ts` | End-to-end full flow |
| `dispute-flow.spec.ts` | Dispute processing flow |
| `new-features.spec.ts` | New feature validation |
| `production-smoke.spec.ts` | Production smoke test |

### 6.2 Test Configuration

**Vitest** (`vitest.config.ts`):
- Environment: node
- Globals: true
- Excludes: node_modules, mobile, e2e
- Path alias: `@/` → `./src/`
- Run: `npm test` (vitest run) or `npm run test:watch`

**Playwright** (`playwright.config.ts`):
- Test dir: `./e2e`
- Timeout: 60s (assertion 10s)
- Base URL: `https://deal-protocol-phi.vercel.app`
- Headless: true
- Run: `npm run test:e2e` or `npm run test:smoke`

### 6.3 Environment Variables (`.env.example` — 33 variables)

```
# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL

# ── LLM / AI ──
AI_PROVIDER                        # deepseek | gemini | openai
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
GEMINI_API_KEY
OPENCODE_GITHUB_TOKEN

# ── SMS Auth (Aliyun) ──
ALIYUN_SMS_ACCESS_KEY
ALIYUN_SMS_SECRET
ALIYUN_SMS_SIGN_NAME
ALIYUN_SMS_TEMPLATE_CODE

# ── Stripe ──
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# ── Payment Channel ──
PAYMENT_CHANNEL                    # alipay | stripe | mock

# ── Alipay ──
ALIPAY_APP_ID
ALIPAY_PRIVATE_KEY
ALIPAY_PUBLIC_KEY
ALIPAY_GATEWAY

# ── WeChat ──
WECHAT_APP_ID
WECHAT_APP_SECRET
WECHAT_MCH_ID
WECHAT_PAY_API_KEY

# ── Payment ──
PAYMENT_NOTIFY_URL
PAYMENT_SANDBOX                    # true/false

# ── Push Notifications ──
REDIS_URL
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
FCM_SERVER_KEY

# ── SOS ──
SMS_API_URL
SMS_API_KEY
PUSH_API_URL
PUSH_API_KEY

# ── Other ──
REAL_NAME_API_KEY
CRON_SECRET
PII_ENCRYPTION_KEY
NEXT_PUBLIC_METRICS_BACKEND
```

---

## 7. Architecture Patterns

### 7.1 Module Structure
Monorepo-style modular monolith using `src/modules/mXX-*` pattern:
- **m02**–**m14**: Vertical domain modules with focused responsibilities
- **mM02**–**mM13**: Empty mirror modules (future micro-frontend separation?)
- Module boundaries enforced by convention (not build tool)

### 7.2 API Route Pattern
Next.js App Router + Route Handlers with:
- `auth()` middleware from `src/lib/auth.ts` for cookie-based session
- `getSupabase()` / `getServiceClient()` for DB access
- Zod validation (via `src/lib/types.ts` or inline)
- JSON response wrapper

### 7.3 State Machine
`contract-machine.ts` + `lib/contract/*` files define:
- Fund statuses: PENDING_HELD → HELD → COMPLETED / SATISFACTION_HELD → SETTLED
- Service stages: NOT_ACCEPTED → ACCEPTED → DEPARTED → ARRIVED → IN_PROGRESS → DONE
- Transitions validated against current state

### 7.4 AI Pipeline
```
User Input → LLM Classification → Schema Matching → Protocol Generation → 
  → Vector Embedding → Hybrid Matching (60% similarity + 30% rep + 10% budget) →
  → Contract → Fulfillment → Quality Inspection (Vision AI) → Settlement
```

### 7.5 Key Design Decisions
- **Single monorepo** with `packages/` for shared modules
- **No Prisma** — direct Supabase client + SQL migrations
- **No database.types.ts** — DB types not code-generated
- **Mock-first** — all external services have mock fallbacks for dev
- **Append-only evidence** — `evidence_log` prevents any UPDATE/DELETE at RLS level
- **Database-level role isolation** — `bandit_reader` role explicitly denied access to credit data
- **Multi-channel payment** — unified `IPaymentProvider` interface
- **Soft delete** — `deleted_at` column on `profiles` and `users`

---

## 8. Known Gaps & Risks

- `database.types.ts` missing — no TypeScript types for DB schema
- Mirror modules (mM02–mM13) are empty — unclear intent
- DeepSeek via OpenAI-compatible adapter — model compatibility risk
- Service Worker (`sw.ts`) exists but offline strategy unclear
- No explicit rate limiting strategy beyond `rate-limit.ts`
- PII encryption key management for production
- Some API routes lack input validation (Zod not consistently applied)
- Test coverage unknown — 42 test files but no coverage report

---

## 9. Deployment

| Environment | Target | Notes |
|-------------|--------|-------|
| Production | Vercel (deal-protocol-phi.vercel.app) | `npm run build` + `npm start` |
| Docker | Dockerfile + docker-compose.yml | `web:3000`, `db:postgres:15` |
| Local Dev | `next dev` | Supabase local or remote |

Docker compose runs: **web** (Next.js standalone) + **db** (PostgreSQL 15 with Supabase-compatible schema).
