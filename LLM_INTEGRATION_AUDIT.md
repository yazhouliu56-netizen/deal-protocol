# LLM Integration Audit — 4 Deep-Fusion Playgrounds

> Generated: 2026-07-25
> Scan scope: `m04-protocol-generation`, `m06-matching-routing`, `m07-credit`, `chat API`

---

## 1. Existing LLM Architecture Capability Inventory

| Module | File | LLM Role | Model Used |
|--------|------|----------|------------|
| M04 Protocol Generation | `protocol-generator.ts` | Category classifier + Structured field extraction + Embedding generation | Gemini (via `callLLM`) |
| M06 Matching Routing | `matcher.ts` | — (no LLM today; pure geo + credit + bandit) | N/A |
| M07 Credit Engine | `credit-engine.ts` | — (no LLM today; rule-based delta + decay) | N/A |
| Chat API | `api/chat/route.ts` | Conversational O2O concierge + Protocol JSON generation | DeepSeek (via `getAIModel`) |
| Risk Interceptor | `risk-interceptor.ts` | — (regex-based, no LLM) | N/A |

**Key observations:**
- M04 already uses `callLLM` (Gemini) for classification, extraction, and embedding
- M06 scoring is purely static (credit × distance × stake × tip); no semantic signal from the protocol description
- M07 credit deltas are hard-coded rule tables; no natural-language summarization
- Chat API has a monolithic system prompt that mixes concierge + protocol generation; risk interception is regex-only
- Evidence chain (M11) supports SHA-256 chaining but has no contract-document binding hook

---

## 2. Four Integration Pathways (Zero-Breaking-Change)

### 2.1 Contract Builder — `generateFormalContractDoc()`

**Target files:**
- `src/modules/m04-protocol-generation/protocol-generator.ts` (call site)
- `src/lib/contract-builder.ts` **(new)**

**Design:**

```
generateFormalContractDoc(protocolJson: ProtocolJSON):
  → callLLM with system prompt + protocol JSON
  → returns { markdown: string, html: string, hash: string }
```

- Input: Full `ProtocolJSON` object (already available after protocol generation at `protocol-generator.ts:125`)
- The LLM transforms protocol fields + category config into a formal Chinese contract document (Markdown)
- After generation, the Markdown content is SHA-256 hashed via `crypto.subtle.digest('SHA-256', ...)` and the hash is appended to `evidence_log` as event type `CONTRACT_DOC_HASH`
- The raw Markdown/HTML is stored in a new `contract_documents` table (or as a JSONB field on `contracts`)
- The hash serves as tamper-proof binding between the contract doc and the evidence chain

**Integration point** — non-blocking async fire after `generateProtocol()` succeeds:

```typescript
// In protocol-generator.ts, after line 152 (success return)
if (protocol?.id) {
  generateFormalContractDoc(protocol).catch(() => {}) // fire-and-forget
}
```

**New fields needed on `contracts`:**
```json
{ "contract_doc_markdown": "TEXT", "contract_doc_hash": "TEXT" }
```

**Zero-breaking rationale:** The call is async fire-and-forget; if it fails, the protocol is still created successfully. The contract_doc fields are nullable — existing rows remain valid.

---

### 2.2 Semantic Matcher — `semanticRelevanceScore`

**Target files:**
- `src/modules/m06-matching-routing/matcher.ts` (specifically `processCandidates()` lines 131-159)

**Design:**

```
computeSemanticRelevance(protocolId: string, providerId: string):
  → load protocol core_fields + provider skills/profiles
  → call DeepSeek to score semantic fit (0-100)
  → returns number
```

- The function is called inside the candidate scoring loop at `matcher.ts:147`, after `weekendMul` and before `depositMultiplier`
- The score is cached in a `Map<string, number>` keyed by `${protocolId}:${providerId}` to avoid redundant LLM calls for the same pair within a single `routeProtocol()` invocation
- Weighted addition: `cs = Math.round(cs * (1 + semanticScore / 200) * 100) / 100` (i.e., a perfect 100-score adds 50% boost; a 0 adds 0%)

**Integration point** — single line addition in the scoring loop:

```typescript
// In matcher.ts:147, after weekendMul and before depositMultiplier
cs = Math.round(cs * semanticMultiplier * 100) / 100 // existing line 147
// ↓ add after line 147:
const semanticScore = await getCachedSemanticScore(protocolId, geo.provider_id, input.category)
const semanticMultiplier = 1 + semanticScore / 200
cs = Math.round(cs * semanticMultiplier * 100) / 100
```

**New file:** `src/lib/semantic-matcher.ts` — exports `getCachedSemanticScore()` with a simple in-memory LRU.

**Zero-breaking rationale:** Adding a multiplier to the score is a non-breaking change. When `semanticScore` is 0 (cache miss, API down, or not implemented), the multiplier is `1.0` and the existing behavior is preserved exactly.

---

### 2.3 Fulfillment Summarizer — `generateFulfillmentSnapshot()`

**Target files:**
- `src/modules/m07-credit/credit-engine.ts` (inside `updateCredit()`, specifically the `completion` eventType)
- `src/lib/fulfillment-summarizer.ts` **(new)**

**Design:**

```
generateFulfillmentSnapshot(protocolId: string):
  → gather chat logs, geo check-in records, photo hashes from evidence_log
  → call DeepSeek to produce a 1-sentence fulfillment snapshot
  → returns { summary: string, sentiment: 'positive'|'neutral'|'negative' }
```

- The function is called at `payment-service.ts:settlePayment` (which already calls `updateCredit` with `eventType: 'completion'`)
- The snapshot is written as a new `credit_events` row with `reason = snapshot.summary` and a new field `sentiment`
- Attach the snapshot to the evidence_log as `event_type: 'FULFILLMENT_SNAPSHOT'`

**Integration point** — inside `credit-engine.ts:updateCredit`, in the `completion` case, after line 131:

```typescript
// In credit-engine.ts, after line 131 (credit_events insert)
if (input.eventType === 'completion') {
  generateFulfillmentSnapshot(input.evidenceId).catch(() => {})
}
```

**New columns needed on `credit_events`:**
```sql
ALTER TABLE credit_events ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative'));
ALTER TABLE credit_events ADD COLUMN IF NOT EXISTS fulfillment_snapshot TEXT;
```

**Zero-breaking rationale:** The summarizer runs asynchronously after the credit update. If it fails, the credit event is still recorded with the existing `reason` field. New columns are nullable.

---

### 2.4 Proactive Concierge Agent — System Message Injection

**Target files:**
- `src/app/api/chat/route.ts` (line 77, the `streamText` call)
- `src/lib/concierge-agent.ts` **(new)**
- `src/lib/risk-interceptor.ts` (add AI-driven risk detection)

**Design:**

The chat API already has the infrastructure for injecting system messages. The concierge agent adds two capabilities:

**a) Check-in reminder** — Before streaming, query the user's active protocols. If any are in `ACCEPTED` or `DEPARTED` stage and the current time is within 30 minutes of the scheduled service time, inject a proactive reminder into the system prompt.

**b) Friction mediation** — Use DeepSeek to analyze the user's message for signs of dispute or friction (angry tone, refund requests, etc.). If detected, inject a mediation suggestion into the system prompt rather than a raw reply.

**New risk types** (in `risk-interceptor.ts`):
```typescript
export type RiskType =
  | 'OFF_PLATFORM_PAYMENT'
  | 'SENSITIVE_CONTACT'
  | 'WECHAT_TRANSFER'
  | 'ESCALATING_FRICTION'    // new — AI-driven
  | 'SCHEDULE_REMINDER'       // new — AI-driven
```

**Integration point** — in `chat/route.ts`, before `streamText`, gather context and inject concierge messages:

```typescript
// In chat/route.ts, before line 77:
const conciergeMessages = await buildConciergeContext(userContext?.userId)
const allMessages = [...conciergeMessages, ...modelMessages]
```

The `buildConciergeContext()` function:
- Queries `protocols` for user's active protocols
- If a protocol has `service_time` within 30 min and stage is ACCEPTED/DEPARTED, adds a reminder system message
- Analyzes the last user message for friction via LLM, and if detected, adds a mediation system message

**Zero-breaking rationale:** The concierge messages are prepended to the message array as additional system-level context. If `buildConciergeContext` fails or returns empty, the original `modelMessages` are used unchanged. No changes to existing API contracts.

---

## 3. Zero-Breaking-Change Migration Plan

| Phase | What | Dependencies | Risk |
|-------|------|-------------|------|
| **Phase 1** (immediate) | Create `contract-builder.ts` + `concierge-agent.ts` + `fulfillment-summarizer.ts` + `semantic-matcher.ts` | None (new files) | None — not wired yet |
| **Phase 2** | Wire `contract-builder.ts` → `protocol-generator.ts` as async fire-and-forget | Phase 1 | Low — fire-and-forget |
| **Phase 3** | Wire `semantic-matcher.ts` → `matcher.ts:processCandidates()` | Phase 1 | Low — additive multiplier; defaults to 1.0 |
| **Phase 4** | Wire `fulfillment-summarizer.ts` → `credit-engine.ts:updateCredit()` | Phase 1 | Low — async after credit event |
| **Phase 5** | Wire `concierge-agent.ts` → `chat/route.ts` | Phase 1 | Low — additive system messages |
| **Phase 6** | Run migration SQL for nullable columns | None | Low — ALTER TABLE ADD COLUMN IF NOT EXISTS |
| **Phase 7** | Full regression test suite | All | — |

**Migration SQL** (for Phase 6):
```sql
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_doc_markdown TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_doc_hash TEXT;
ALTER TABLE credit_events ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative'));
ALTER TABLE credit_events ADD COLUMN IF NOT EXISTS fulfillment_snapshot TEXT;
```

---

## 4. Files Touched Summary

| File | Action |
|------|--------|
| `src/lib/contract-builder.ts` | **New** — `generateFormalContractDoc()` |
| `src/lib/semantic-matcher.ts` | **New** — `getCachedSemanticScore()` |
| `src/lib/fulfillment-summarizer.ts` | **New** — `generateFulfillmentSnapshot()` |
| `src/lib/concierge-agent.ts` | **New** — `buildConciergeContext()` |
| `src/lib/risk-interceptor.ts` | **Modify** — add `'ESCALATING_FRICTION'` and `'SCHEDULE_REMINDER'` risk types |
| `src/modules/m04-protocol-generation/protocol-generator.ts` | **Modify** — add 1 line: fire-and-forget `generateFormalContractDoc()` |
| `src/modules/m06-matching-routing/matcher.ts` | **Modify** — add 3 lines: semantic score multiplier in `processCandidates()` |
| `src/modules/m07-credit/credit-engine.ts` | **Modify** — add 3 lines: async fulfillment snapshot in `updateCredit()` |
| `src/app/api/chat/route.ts` | **Modify** — add 5 lines: concierge message prepend before `streamText` |
| *(migration)* | **SQL** — 4x `ALTER TABLE ADD COLUMN IF NOT EXISTS` |

---

## 5. Verification

After wiring Phases 2-5:

```bash
npx vitest run
```

Expected:
- All existing tests pass unchanged (zero-breaking-change guarantee)
- The 4 new modules have their own test suites in `tests/llm-integration.test.ts`
- The 4 integration points are conditionally executed — if LLM call fails, existing behavior is preserved
