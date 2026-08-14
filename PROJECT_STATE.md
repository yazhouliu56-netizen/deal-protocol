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

#### Unit Tests (Vitest) — 43 files in `tests/`
| Test File | Coverage Area |
|-----------|---------------|
| `m01-bandit-isolation.test.ts` | Bandit 角色物理隔离（P0-02） |
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

---

# 🚀 PROJECT STATE SUPPLEMENT & CHANGELOG (P0–P2 Evolution)

> **Updated**: 2026-07-29  
> **Status**: P0-P2 Architectural Refinement Completed (16/16 Integration Tests Passed, 0 TS Errors)

---

## 1. Executive Summary of Refinements (P0–P2)

本项目在保持线上 28+ 数据库表、多渠道支付（Stripe/支付宝/微信）、7 态资金状态机与既有 API 100% 后向兼容的前提下，完成了"无痛增量演进"。消除了第 8 章提出的核心已知隐患，建立了统一类型契约、Zod 防御性校验网关、判例 RAG 智能仲裁以及 Checkpoint 24h 自动解冻机制。

---

## 2. Updated Component Architecture & Module Matrix

### 2.1 数据库强类型契约与 Schema 扩展
- **新增强类型定义文件**：`src/types/database.types.ts`
  - 覆盖全量 29 张表（包含 `profiles`, `protocols`, `demands`, `contracts`, `orders`, `milestone_schedules`, `evidence_log`, `credit_records`, `precedents`, `llm_logs` 等）。
  - 提供 `Row`, `Insert`, `Update` 泛型支持，完全类型化 `Json` 字段、`pgvector` (1024d/1536d `number[]`) 及 `PostGIS` 空间字段。
  - 导出 `Tables<T>`, `TablesInsert<T>`, `TablesUpdate<T>` 全局辅助工具。
- **数据库迁移扩展**：`supabase/migrations/20260730_add_checkpoint_fields.sql`
  - 拓展 `milestone_schedules` 表的 `auto_confirm_at` 字段及 `submitted` / `completed` / `skipped` 状态约束。

### 2.2 统一 API 校验网关与防御性字段剥离
- **新增校验网关库**：`src/lib/validations/api-schemas.ts`
  - 针对需求发布 (`createDemandSchema`)、协议生成 (`generateProtocolSchema`)、争议仲裁 (`arbitrateDisputeSchema`)、提现申请 (`withdrawRequestSchema`) 建立标准 Zod 逻辑。
  - **防御机制**：提供 `validateApiInput<T>` 统一网关函数，利用 Zod 自动剥离（strip）未声明的非合法参数，防止恶意客户端注入。
  - 导出了自动推导的强类型别名（如 `CreateDemandInput`）。

### 2.3 判例 RAG 与多视角智能仲裁引擎
- **升级核心模块**：`src/lib/ai-arbitrator.ts`
  - **判例 RAG 检索**：仲裁前自动查询 Supabase `precedents` 判例库，提取 Top 3 最相关历史判例作为 Prompt 上下文。
  - **三视角 Prompting**：融合**硬核契约派**（条款/证据链）、**行业常理派**（惯例/合理时效）与**权益保护派**（民法典/公平原则）。
  - **结构化输出与容错**：强约束输出包含 `winner`, `reasoning`, `confidence`, `fund_split_ratio`, `credit_impact` 的 JSON。
  - **低置信度降级机制**：置信度 `< 0.85` 或解析异常时自动标记 `requires_human_review: true`，平滑回退至人工/老用户陪审团复核。

### 2.4 履约资金分段解冻与 24h 超时批处理
- **升级履约模块**：`src/lib/milestone-escrow.ts`
  - **Checkpoint 提交 (`submitMilestoneCheckpoint`)**：服务者提交节点凭证，自动计算并设置 24h 后的 `auto_confirm_at` 时间戳。
  - **客户确认 (`confirmMilestoneCheckpoint`)**：客户主动确认，触发状态更新为 `completed` 并清空超时时间。
  - **超时批处理 (`processExpiredCheckpoints`)**：供 Cron Job (`/api/cron/check-timeouts`) 自动批量检索并解冻客户 24h 无响应的倒计时节点，平滑释放托管资金，与 `contract-machine.ts` 完美兼容。

### 2.5 架构镜像目录与解耦占位规范
- **重构架构文件**：`src/modules/mM02-mM13/index.ts`
  - 明确本项目采用 **Modular Monolith** 架构，活跃业务落盘于 `src/modules/mXX-*`。
  - 导出 `MIRROR_MODULES_REGISTRY` 注册表与 `getDomainModule` 助手，明确 `mM02`–`mM13` 作为未来解耦占位镜像的定位，解决第 8 章的架构悬空隐患。

### 2.6 端到端集成测试基线
- **新增集成测试套件**：`tests/p2-integration.test.ts`
  - 涵盖输入校验防护、AI 仲裁降级、Checkpoint 解冻与镜像注册表 4 大核心领域。
  - 配合全量测试命令 `pnpm test`，实现测试覆盖率提升与 100% 通过率。

---

## 3. Section 8 Known Gaps Remediation Status

| 原已知隐患 (Known Risk/Gap) | 修复状态 | 落地解法与成果 |
| :--- | :--- | :--- |
| **`database.types.ts` missing** | ✅ Resolved | 新建 `src/types/database.types.ts`，全量 29 张表实现类型覆盖 |
| **Mirror modules (mM02–mM13) empty** | ✅ Resolved | 规范 `src/modules/mM02-mM13/index.ts` 注册表与活跃模块映射关系 |
| **Inconsistent API Zod Validation** | ✅ Resolved | 新建 `src/lib/validations/api-schemas.ts` 并实现 `validateApiInput` 网关 |
| **Single-LLM Dispute Arbitration Risks** | ✅ Resolved | 升级 `src/lib/ai-arbitrator.ts`，引入 precedents RAG 与 3 视角降级 |
| **Rigid All-or-Nothing Escrow** | ✅ Resolved | 扩展 `src/lib/milestone-escrow.ts` 支持 Checkpoint 分段 24h 解冻 |
| **Integration Test Coverage** | ✅ Resolved | 新建 `tests/p2-integration.test.ts` (16/16 passed) |

---

# 📖 OpenCode CLI 任务指令标准规范与工作流手册 (Workflow Playbook)

> **适用场景**: 顶层 AI 架构师 (LLM Architect) 向 本地终端执行工具 (OpenCode CLI) 派发代码修改、重构与新功能 Task 时使用。  
> **核心原则**: 增量演进 · 零破坏性 · 类型先行 · 自动化闭环

---

## 1. 💡 双 AI 协同成功经验总结 (Key Principles)

1. **架构防御优先 (Architecture-First Defense)**：任何新方案接入前，先进行"冲突与风险审查"，严禁直接覆盖数据库 Schema、支付 Webhook 或鉴权核心。
2. **离散原子任务 (Discrete Atomic Tasks)**：大需求必须拆解为独立的 Task 1, Task 2...，保证单个 Task 变更可控、单次测试可验证、单次提交可回滚。
3. **强类型与防御网关 (Type Safety & Defensive Gateways)**：先写 DB/API 类型定义与 Zod 校验，再写业务逻辑，从源头阻断非法参数注入。
4. **终端自动化闭环 (Command-Driven Verification)**：每一个 Task 必须指定具体的终端验证命令（`tsc --noEmit` + `pnpm test`），由 OpenCode 自动执行并以测试结果判定 Task 是否完成。

---

## 2. 📋 OpenCode CLI 标准任务派发模板 (Task Template)

在向 OpenCode CLI 发送任务时，必须严格遵守以下格式：

```markdown
### 📌 阶段目标：[简要描述当前阶段的核心目标，例如：建立统一 API 输入校验网关]

#### 📝 Task [编号]: [任务简述，例如：规范 api-schemas.ts 中的 Zod 校验与类型推导]
- **目标文件/路径**：`[相对路径，例如：src/lib/validations/api-schemas.ts]`
- **变更类型**：`[新建 / 修改 / 重构 / 删除]`
- **核心逻辑指导**：
  1. [具体的逻辑变更点 1]
  2. [具体的逻辑变更点 2]
  3. [防御性限制/边界处理说明]
- **代码/配置参考**：
  ```[language]
  // 提供完整、可直接落盘或高度精确的核心代码块、接口定义与导出声明
```
- **验证标准 (Verification)**：
  - **终端命令**：`[例如：npx tsc --noEmit && pnpm test tests/my-test.test.ts]`
  - **预期结果**：`[例如：TypeScript 编译零报错，相关测试用例 100% 通过]`
```

---

## 3. 🎯 模板各要素编写规范

### 3.1 任务目标与文件路径声明规范
- **文件路径**：必须明确给出项目根目录下的**相对路径**（例如 `src/lib/ai-arbitrator.ts`），禁止使用模糊文件名。
- **变更类型**：明确标注 `新建` / `修改` / `重构` / `删除`，方便 CLI 确认操作动词（`create` / `edit` / `delete`）。

### 3.2 类型与防御性校验约束
- **TypeScript**：新增/修改代码时，必须优先引用 `src/types/database.types.ts` 或定义显式 Interface，**严禁引入 `any` 类型**。
- **Zod 防御网关**：涉及 API 路由或外部参数输入时，必须使用 Zod Schema 进行 `.strip()`（默认剥离未声明字段）与范围校验（如 `min/max/uuid/positive`）。
- **容错降级**：所有依赖外部服务（LLM/支付/第三方 API）的代码，必须包含 `try-catch` 兜底与默认降级数据输出，禁止未捕获的异常导致 API 挂起。

### 3.3 必须执行的终端验证命令结构
每个任务结尾必须提供由 OpenCode 执行的终端验证指令组合：

```bash
# 标准校验组合拳：静态类型检查 + 指定单元/集成测试
npx tsc --noEmit && pnpm test [相关测试文件路径]
```

> **通过标准**：`Process exited with code 0`，且测试用例通过率 100%。

---

## 4. 🚨 报错反哺与修复任务格式 (Error Feedback Template)

当 OpenCode 执行终端命令产生报错或测试失败时，无需扩大修改范围，应使用以下反哺格式将错误反馈给架构师 AI，请求针对性修复 Task：

```markdown
### ⚠️ OpenCode 终端执行报错反哺

- **执行 Task**：[Task 编号与名称]
- **报错指令**：`[例如：npx tsc --noEmit]`
- **终端报错信息 (Error Output)**：
  ```text
  [粘贴终端输出的具体错误栈、TypeScript 报错码 TS2322 或 Vitest Fail 信息]
  ```
- **受影响代码上下文**：[受影响的文件及行号]
- **👉 请架构师仅针对上述报错根源，生成针对性的【Task X.1 专项修复指令】。**
```

<!-- ================================================================= -->
<!-- 增量更新 PATCH: 2026-07-29 | UI/UX 赛博二次元重构与 Phase A/B 架构治理 -->
<!-- ================================================================= -->

# 🚀 架构与技术演进 Patch (2026-07-29)

## 1. 🎨 前端 UI/UX 与多主题引擎架构

### 1.1 四套主题引擎 (Multi-Theme Engine)
采用轻量级 Context/CSS Variable 架构，全站组件自动适配以下四套主题：
* **`cyber-pop`**：霓虹赛博（默认）— 高饱和荧光粉/青蓝、高对比发光边框。
* **`soft-astral`**：柔和星空 — 渐变紫蓝、星芒浮光、柔和玻璃拟态。
* **`tactical-hud`**：战术战报 — 军规青绿、网格线框、极简数据卡片。
* **`pro-minimal`**：专业极简 — 黑白灰高质感、无过度修饰，适合商务交接。

**核心控制组件**：
* `src/components/theme/theme-provider.tsx` — 全局主题状态管理。
* `src/components/theme/theme-switcher.tsx` — 快捷主题切换浮窗。

### 1.2 二次元游戏化核心组件矩阵
| 组件路径 | 业务与交互特色 |
| :--- | :--- |
| `src/components/gacha/gacha-modal.tsx` | 三阶段开箱动效 (`idle` 悬浮 ➔ `opening` 粒子聚能 ➔ `revealed` SSR/SR/R 卡牌翻转掉落)。 |
| `src/components/ui/cyber-oracle-dialog.tsx` | Galgame 赛博裁决姬对话框，支持 4 种表情态切换与实时打字机吐字流，内建 `[休眠保护模式]` 静默降级。 |
| `src/components/escrow/checkpoint-timer.tsx` | 24h Checkpoint 环形/条形倒计时，支持"落印确认解冻"与盲盒开箱联动。 |
| `src/components/ai/ai-arbitration-card.tsx` | AI 赛博裁决三视角（契约/常理/权益）权重图谱与置信度仪表盘，低于 85% 自动高亮人工作业警示。 |
| `src/components/demands/demand-card.tsx` | 悬赏令卡片：Tilt Hover 动效、7 态资金 Badge、Mod 芯片卡槽与发榜人立绘框。 |
| `src/components/profile/inventory-grid.tsx` | 盲盒成就背包：SSR/SR/R 稀有度边框发光、道具装备/使用详情 Modal。 |

---

## 2. 🔒 Phase A：资金安全与原子锁架构

### 2.1 行级安全策略 (RLS Lockout)
在 Supabase 层对敏感数据表设置严苛防篡改约束（`supabase/migrations/20260801_audit_rls_and_rpc.sql`）：
* **`profiles`**：通过 `UPDATE WITH CHECK` 与 `IS NOT DISTINCT FROM` 锚定 `balance`, `credit_score`, `reputation_score`, `trust_tier`，拦截来自客户端 SDK 的直接修改。
* **`contracts / orders / milestone_schedules`**：封锁客户端直接修改 `fund_status`, `status`, `escrow_status` 资金敏感字段。

### 2.2 存储过程与原子幂等锁 (Security Definer RPC)
解冻与打款逻辑强制收敛至数据库 RPC，防御并发重放与连击攻击：
1. **`release_checkpoint_rpc`**：解冻 Checkpoint 阶段资金。
2. **`sla_auto_release_rpc`**：SLA 超时自动解冻。
* **幂等机制**：以 `.eq('status', 'submitted')` 为条件原子更新，并配合 `wallet_logs`（拓展类型：`milestone_payout` | `sla_release` | `checkpoint_release`）作重复校验，确保解冻操作有且仅有一次成功。

---

## 3. 🎨 Phase B：复原力与缓存重算 (UI Resilience & Revalidation)

### 3.1 赛博风格空状态与骨架屏
* **`CyberEmptyState`** (`src/components/ui/cyber-empty-state.tsx`)：玻璃拟态卡片 + 虚线发光边框 + 动画入场，优雅处理无数据场景。
* **`CyberSkeleton`** (`src/components/ui/cyber-skeleton.tsx`)：提供 `DemandCardSkeleton`、`EscrowStatsSkeleton`、`VerdictCardSkeleton`、`InventoryItemSkeleton` 4 种脉冲骨架屏，彻底消解 Cumulative Layout Shift (CLS)。

### 3.2 服务端缓存重算 (Server Revalidation)
在关键状态变更的 API Handlers 中注入 `revalidatePath`，保障数据变更后视图实时刷新：
* `POST /api/demands` ➔ `revalidatePath('/demands')`
* `POST /api/payment/escrow` ➔ `revalidatePath('/demands/[id]')` & `revalidatePath('/profile')`
* `POST /api/payment/release` ➔ `revalidatePath('/demands/[id]')` & `revalidatePath('/profile')`
* `PATCH /api/orders/[id]` ➔ `revalidatePath('/demands/[id]')` & `revalidatePath('/profile')`

---

## 4. 🛠️ 类型定义与 AI SDK 流式规范

* **TypeScript 校验**：实现全项目 0 类型报错（`npx tsc --noEmit` 验证通过）。
* **AI SDK V4 对齐**：`src/lib/ai-negotiator.ts` 全量拥抱 `streamText` 与 `toTextStreamResponse()`，服务端 API 配合 `NextResponse` 返回 Text Stream Body，打通流式响应管道。

---

*本规范由 deal-protocol 首席架构师制定，用于保障项目全局演进的严谨性与自动化效率。*

<!-- ================================================================= -->
<!-- 归档 PATCH: v3.0.0-PROD 生产环境稳定基线打卡                       -->
<!-- ================================================================= -->

# 🏁 Deal Protocol — Project Baseline Archive (v3.0.0-PROD)

> **Updated**: 2026-07-30  
> **Status**: `PRODUCTION_READY / DEPLOYED`  
> **Target**: Vercel Production Environment (Ready)  

---

## 0. 根仓基线维护声明（2026-08-14）

> 本文件为**父项目（deal-protocol 根）**的状态档案。`oto-spatial-web/` 子项目独立状态档案见 `docs/PROJECT_STATUS.md`（单一真相源），两者互不覆盖。

- **2026-08 起根仓进入基线冻结期**：自 v3.0.0-PROD（2026-07-30）后，根代码除少量维护性修复（LLM 审计 env 键名兼容、阿里云短信键名容错、Vercel credit-decay cron 排程、db:types 输出路径对齐）外无功能性演进；后续功能迭代集中在 `oto-spatial-web/` 子项目。
- **包管理器收敛**：2026-08-14 删除 `bun.lock` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`，统一以 npm（`package-lock.json`）为准。
- **仓库卫生清理**：2026-08-14 移除一次性迁移脚本、运行日志与本地 DB 产物（详见根 .gitignore 追加规则）。
- **已知遗留（未解决，维持现状）**：P0-01 双代码路径（demands/orders ↔ protocols/contracts）仍并存；P0-03 阶梯佣金未在结算中落实；P1 系列体验缺口与 P2 细节偏离——详见 `DESIGN_PLAN_ALIGNMENT_REPORT.md`（P0-02/04/05 已于 2026-08-14 勾销闭环）。

---

## 1. v3.0.0 核心里程碑成果 (Milestone Summary)

### 1.1 数据库防篡改与 SLA 自动解冻锁 (DB Security & Idempotent RPC)
- **5 表防范性 DDL**：在 `profiles`, `orders`, `contracts`, `milestone_schedules`, `wallet_logs` 上部署防御性列创建 DDL 块，保障 Migration 100% 幂等执行。
- **RLS 客户端防篡改锁**：封锁客户端 Client SDK 直接 UPDATE 资金余额与交易状态的权限。
- **SLA 自动解冻存储过程**：`process_milestone_sla_timeouts` 结合 `WHERE status = 'submitted'` 原子条件，防止双重解冻与并发打款。

### 1.2 全 API 路由防护与零 500 优雅降级 (API Resilience)
- **环境变量断言门网**：在 Supabase Client 初始化前检查 `NEXT_PUBLIC_SUPABASE_URL`。
- **全局 Try-Catch 捕获**：`/api/profile`（降级 `{ user: null }`）与 `/api/notifications`（降级 `{ notifications: [] }`），彻底消灭 500 Internal Error。

### 1.3 OpenGraph 图片生成器 Runtime 优化 (Vercel Runtime Tuning)
- 扫荡全网 `opengraph-image.tsx`，将 `runtime` 统一切换为 `'nodejs'`。
- 成功解锁 Vercel 1MB Edge Function 体积卡点（上限扩展至 50MB Serverless Function），完美支持 `@vercel/og`。

### 1.4 二次元 ACG / 异世界公会 UI 重构与 4 套主题换肤
- **首页重构**："异世界冒险者公会"重构（"发布异世界悬赏，召集顶尖冒险者"）。
- **4 套主题实时换肤**：打通 `ThemeProvider` ➔ `<html>[data-theme]` ➔ `globals.css` 主题变量链条：
  - `cyber-pop`（赛博霓虹 - 默认）
  - `soft-astral`（星空工坊 - 蓝紫云幻）
  - `tactical-hud`（战术终端 - 黑绿荧光）
  - `pro-minimal`（极简干练 - 冷灰商务）

---

## 2. 待讨论与下一阶段 Roadmap (Pending Discussions) `[IN_DISCUSSION]`

- [ ] **[IN_DISCUSSION] 跨链代币 (Web3 Token) 与灵魂绑定勋章 (SBT) 部署**
- [ ] **[IN_DISCUSSION] A2A Agent 通信协议 (2027 Agent-to-Agent Mesh) 标准升级**
- [ ] **[IN_DISCUSSION] 多语言全球化 (i18n) 异世界奇遇文案支持**
