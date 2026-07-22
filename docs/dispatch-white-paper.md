# Real-Time Dispatch System — Technical White Paper

## I. Core Data Topology & Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  END-TO-END LIFECYCLE                                                        │
│                                                                              │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │  User     │   │  useChat()   │   │  Shadow          │   │  Left Panel  │  │
│  │  Input    │──▶│  /api/chat   │──▶│  Interceptor     │──▶│  Canvas      │  │
│  │  (大白话) │   │  streaming   │   │  useEffect       │   │  State       │  │
│  └──────────┘   └──────┬───────┘   └────────┬─────────┘   └──────┬───────┘  │
│                         │                    │                    │           │
│                  ┌──────▼───────┐    ┌───────▼────────┐          │           │
│                  │  GPT-4o-mini │    │  Regex Extract │          │           │
│                  │  StreamText  │    │  [PROTOCOL_    │          │           │
│                  │  + [PROTOCOL │    │  JSON]...      │          │           │
│                  │  _JSON]      │    │  [/PROTOCOL_   │          │           │
│                  │  tags        │    │  JSON]         │          │           │
│                  └──────────────┘    └────────────────┘          │           │
│                                                                  │           │
│                                                   ┌──────────────▼────────┐  │
│                                                   │  User clicks          │  │
│                                                   │  "确认无误，广播数字协议"  │  │
│                                                   └──────────────┬────────┘  │
│                                                                  │           │
│                    ┌──────────────────────────────────────────────▼──────┐   │
│                    │  Frontend: handleBroadcast()                        │   │
│                    │  • budget cleaning (￥198 → 198)                    │   │
│                    │  • field truncation (category.slice(0,50))          │   │
│                    │  • description assembly (address + time + prefs)    │   │
│                    │  • POST /api/demands                                │   │
│                    └──────────────────────────────┬──────────────────────┘   │
│                                                   │                          │
│                    ┌──────────────────────────────▼──────────────────────┐   │
│                    │  Backend: POST /api/demands                         │   │
│                    │  • auth() session validation                        │   │
│                    │  • protocolRegistry.match(category) → protocolId    │   │
│                    │  • supabase.from('demands').insert({...})           │   │
│                    │  • findMatches(category) → auto-match (sync!)       │   │
│                    │  • UPDATE matched_provider_id + status              │   │
│                    │  • Response: { id: demand.id }                     │   │
│                    └──────────────────────────────┬──────────────────────┘   │
│                                                   │                          │
│                    ┌──────────────────────────────▼──────────────────────┐   │
│                    │  Supabase PostgreSQL: demands table                 │   │
│                    │  • customer_id, title, description, category        │   │
│                    │  • protocol_id, budget_min/max, urgency             │   │
│                    │  • status (OPEN/MATCHED/ACCEPTED), version          │   │
│                    │  • matched_provider_id                              │   │
│                    └─────────────────────────────────────────────────────┘   │
│                                                                              │
│  ── Provider side ──                                                         │
│  ┌────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐  │
│  │  Provider Polls │   │  POST /api/      │   │  Contract created in     │  │
│  │  GET /api/      │──▶│  demands/[id]/    │──▶│  contracts table         │  │
│  │  provider/      │   │  assign          │   │  (fund_status, amount)   │  │
│  │  demands        │   │  (optimistic lock)│   │                          │  │
│  └────────────────┘   └──────────────────┘   └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

CLIENT (Browser)                        SERVER (Next.js)                 DATABASE (Supabase)
     │                                      │                              │
     │  POST /api/chat                      │                              │
     │  text: "腰疼想做个按摩"                 │                              │
     │─────────────────────────────────────▶│                              │
     │                                      │  streamText(gpt-4o-mini)     │
     │  ◀── SSE stream ─────────────────────│                              │
     │  [text-delta] "收到您..."              │                              │
     │  [text-delta] "[PROTOCOL_JSON]\n{"    │                              │
     │  [text-delta] "\"category\":\"..."    │                              │
     │  [text-delta] "}[/PROTOCOL_JSON]"    │                              │
     │                                      │                              │
     │  ── Shadow Interceptor ──            │                              │
     │  useEffect /\[PROTOCOL_JSON\]/       │                              │
     │  JSON.parse → setExtractedProtocol   │                              │
     │                                      │                              │
     │  ── Left Panel Renders ──            │                              │
     │  Category: 中式推拿                    │                              │
     │  Budget: ¥198, Duration: 60min       │                              │
     │  Therapist: 女技师, Address: 北京     │                              │
     │  Compliance clauses                  │                              │
     │                                      │                              │
     │  ── User clicks Broadcast ──         │                              │
     │  POST /api/demands                   │                              │
     │  {title, description, category,      │                              │
     │   budgetMin, budgetMax, urgency}     │                              │
     │─────────────────────────────────────▶│                              │
     │                                      │  auth() → session            │
     │                                      │  insert into demands         │
     │                                      │─────────────────────────────▶│
     │                                      │◀── { id: "abc-123" } ──────│
     │                                      │  findMatches(category)       │
     │                                      │─────────────────────────────▶│
     │                                      │◀── [MatchCandidate[]] ──────│
     │                                      │  UPDATE matched_provider_id  │
     │                                      │─────────────────────────────▶│
     │  ◀── { id: "abc-123" } ─────────────│                              │
     │  setPublishedId(data.id)             │                              │
     │  alert("广播成功")                    │                              │
```

## II. Engineering Highlights

### 2.1 Tag Interception Method (indexOf [PROTOCOL_JSON])

The core innovation is replacing Vercel AI SDK's `tools` (Function Calling) mechanism with a pure streaming + tag interception pattern:

- **How it works**: The system prompt instructs GPT-4o-mini to embed a `[PROTOCOL_JSON]{...}[/PROTOCOL_JSON]` block at the end of every response. On the client side, a shadow `useEffect` watches the last assistant message and extracts the JSON via regex. Separately, `renderBubbleContent` uses `indexOf('[PROTOCOL_JSON]')` to substring-truncate the chat bubble, hiding the JSON from the user.

- **Why it's better than Function Calling**: Function Calling has two failure modes — (1) the model may not call the tool at all, leaving the system in an undefined state, and (2) the tool output must be re-injected into the conversation, doubling latency. Tag interception keeps everything in a single streaming pass, with zero additional round-trips.

- **Defense depth**: The shadow interceptor `JSON.parse()` is wrapped in `try...catch` to handle incomplete streams gracefully (streaming not yet finished). The bubble cleaning uses simple string `indexOf` rather than regex, avoiding catastrophic backtracking and multiline edge cases. If the tag is malformed, the user sees the raw AI response (degraded but safe).

### 2.2 Time Anchor Injection

- **Problem**: LLMs have no innate sense of current time. "今天晚上11点" was being resolved to random training-data dates (2023-10-23).

- **Solution**: The backend dynamically computes `new Date().toISOString().split('T')[0]` (e.g., "2026-07-18") and prepends it as a meta-instruction: `【重要时间锚定】当前真实世界的"今天"是 2026-07-18` — right above the system prompt, at the highest-priority position.

- **Effectiveness**: Verified via curl — `service_time` correctly outputs `"2026-07-18T23:00:00"`. This pattern exploits the model's attention bias toward the top of the context window (primacy effect in transformer attention).

### 2.3 Address Merge into Description (📍 Hack)

- **Engineering Trade-off**: When the PostgREST schema cache rejected the `address` column, the team decided to merge `address_hint` into the `description` field with a `📍` prefix.

- **Pros**: Zero-downtime bypass of schema cache staleness. No migration needed. The information is still preserved in the database, accessible via text search.

- **Cons**: Structural degradation — address is no longer a first-class column. LBS (location-based distance filtering) cannot be done at the database level (no `GEOGRAPHY` index). Future queries like "find all demands within 5km" would require parsing the `description` text, which is fragile and slow. This should be treated as a temporary workaround: once the schema cache is refreshed (`NOTIFY pgrst, 'reload schema'`), the code should immediately revert to using a dedicated `address` column.

## III. Vulnerability & Bottleneck Audit

### 3.1 Concurrency: No Atomic Race Protection for Grab-Order

**Severity: MEDIUM-HIGH**

The `POST /api/demands/[id]/assign` route (line 31-44) uses **optimistic locking**:

```typescript
.eq('id', id)
.eq('status', demand.status)   // ← read-time value
.eq('version', demand.version ?? 0)  // ← read-time value
```

This means if two providers attempt to grab the same demand simultaneously:

1. Provider A reads `status = "OPEN"`, `version = 0`
2. Provider B reads `status = "OPEN"`, `version = 0`
3. Provider A's UPDATE succeeds (status→"MATCHED", version→1)
4. Provider B's UPDATE matches ZERO rows (version ≠ 0) → throws "接单失败，需求已被他人接走"

This is **correct** but not **strict**. The race window exists between the SELECT (line 20-24) and UPDATE (line 31-42). With Vercel's serverless cold starts, this window could be 50-200ms. In a flash-grab scenario with 50 concurrent providers, roughly 1-2 pairs could slip through if their HTTP requests arrive within the same Node.js event-loop tick.

**Recommendation**: Add a database-level constraint:
```sql
ALTER TABLE demands ADD CONSTRAINT unique_active_match
  UNIQUE NULLS NOT DISTINCT (status) WHERE status = 'MATCHED';
```
Or use Supabase's `FOR UPDATE SKIP LOCKED` row-level locking in a database function.

### 3.2 Dirty Data: Address Loss in Description

**Severity: MEDIUM**

`description` now contains heterogeneous data: original description + address + time + preferences + health declarations + special requirements — all concatenated with `|` separators.

**Risks**:
- **LBS dead end**: Can't build `WHERE ST_DWithin(location, $point, $radius)` queries. Distance filtering requires parsing `description` with regex, which is O(n) scan.
- **Schema rigidity**: If the AI protocol JSON gains new fields (e.g., `pet_count`, `floor_number`), they all get dumped into `description`, making it a growing monolith.
- **Search bloat**: Full-text search on `description` becomes noisy — matching "技师" in a massage context also matches cleaning contexts where the term appeared coincidentally.

**Recommendation**: Restore the `address` column after schema cache refresh, and consider adding `protocol_json` (JSONB) column to store the full extracted protocol as structured data.

### 3.3 Synchronous Auto-Match Blocks the Response

**Severity: MEDIUM-HIGH**

In `POST /api/demands` (route.ts lines 40-46, 73-84), `findMatches()` is called **synchronously** before returning the response:

```typescript
const matches = await findMatches(body.category)  // ← blocks
// findMatches calls: provider_categories query →
// profiles query → ranker.sort → fallback chain
```

`findMatches` triggers:
1. `provider_categories` query (table scan if no index on `category`)
2. `profiles` query with `.in('id', providerIds)` + `.or('roles...')`
3. `ranker.sort()` — in-memory sort
4. Possible fallback chain: 3 more recursive `findMatches` calls with expanded radii

In the worst case (empty pool → tier 1 → tier 2 → tier 3), this could take **300-800ms**. This time is added to the user's POST response latency, making the "broadcast" button feel slow.

**Recommendation**: Offload `findMatches` to a background job:
```typescript
// Immediate: return { id: demand.id } to user
// Background: await findMatches().then(matches => { update demand })
```
Or use Supabase's realtime CDC + Edge Function to handle matching asynchronously.

### 3.4 Auth Has No Role-Based Access Control

**Severity: LOW-MEDIUM**

The `POST /api/demands` route checks `session.user.id` exists but does not verify the user's `role` is `"CUSTOMER"` or `"CLIENT"`. Any authenticated user (including providers) can create demands. This is a business logic gap, not a security vulnerability per se, but could lead to spam.

## IV. Evolution Roadmap

### 4.1 From Polling to Supabase Realtime (CDC)

**Current state**: Providers poll `GET /api/provider/demands` to find available demands. This is:
- High latency (polling interval ~5s)
- High database load (every 5s, every provider fires a query)
- No instant feedback

**Target**: Supabase Realtime (CDC) + Broadcast

**Required refactoring**:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  Customer    │     │  Supabase   │     │  Provider Device│
│  broadcasts  │     │  Realtime   │     │  (WebSocket)    │
└──────┬───────┘     │  (CDC)      │     └────────┬────────┘
       │            └──────┬──────┘              │
       │  INSERT demands   │                      │
       │──────────────────▶│                      │
       │                   │  channel:demands:     │
       │                   │  INSERT broadcast    │
       │                   │─────────────────────▶│
       │                   │  (payload: demand)   │
       │                   │                      │
       │                   │  Provider clicks     │
       │                   │  "Accept"            │
       │                   │◀────────────────────│
       │                   │  UPDATE version      │
       │                   │  (optimistic lock)   │
       │◀──────────────────│  broadcast:ACCEPTED  │
```

**Code changes needed**:

1. **Enable Realtime on `demands` table**:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE demands;
   ```

2. **Provider-side Supabase client subscribes**:
   ```typescript
   // ProviderDemandsList.tsx
   useEffect(() => {
     const channel = supabase
       .channel('new-demands')
       .on(
         'postgres_changes',
         { event: 'INSERT', schema: 'public', table: 'demands',
           filter: `status=eq.OPEN` },
         (payload) => {
           setDemands(prev => [payload.new, ...prev])
         }
       )
       .subscribe()
     return () => supabase.removeChannel(channel)
   }, [])
   ```

3. **Remove polling logic** from `GET /api/provider/demands`.

4. **Add conflict-free UI**: When two providers see the same demand and both click "Accept", the optimistic lock in `assign/route.ts` already handles this — the second provider gets "接单失败" and the demand disappears from their list.

5. **Optionally add "抢单" (fast-grab) flow**: Use `FOR UPDATE SKIP LOCKED` in a Postgres function for sub-millisecond contention handling.

### 4.2 Additional Architectural Recommendations

| Area | Current State | Target State | Priority |
|------|--------------|--------------|----------|
| **Address storage** | Merged into `description` text | Dedicated `address` column + `lat/lng` for LBS | P0 |
| **Auto-match** | Synchronous in POST handler | Async via queue (Bull/Bree) or Supabase Edge Functions | P1 |
| **Schema protection** | No Zod/Valibot validation | Zod schema on both client and API boundary | P1 |
| **Role enforcement** | Checks auth only | Enforce `role='CUSTOMER'` for demand creation | P2 |
| **Type safety** | `any` casts for protocol JSON | Zod union: `ProtocolHousekeeping | ProtocolMassage` | P2 |
| **Protocol persistence** | In-memory only | Save full `protocol_json` (JSONB) to demands table | P2 |
| **Retry with backoff** | None | Broadcast button has no retry mechanism | P2 |
| **Metrics/monitoring** | `console.error` only | Structured logging + latency tracking | P3 |
