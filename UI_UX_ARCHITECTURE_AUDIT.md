# UI/UX Architecture Audit — Deal Protocol v1.0

**Date:** 2026-07-25  
**Scope:** `src/app/` (31 page routes) + `src/components/` (39 components)  
**Method:** Static code review of 15+ core page/component files across all 5 audit dimensions.

---

## 1. Architecture Health Score

| Dimension | Score | Severity |
|-----------|-------|----------|
| Layout & Navigation | **7/10** | 🟡 |
| Auth & Onboarding | **5/10** | 🟠 |
| AI Demand & Dual-panel UX | **8/10** | 🟢 |
| Order Fulfillment & Chat | **7/10** | 🟡 |
| Design System & Consistency | **6/10** | 🟡 |
| **Overall** | **6.6/10** | 🟡 |

---

## 2. Defect Inventory by Dimension

### 2.1 Global Layout & Navigation

| # | File | Issue | Severity |
|---|------|-------|----------|
| L1 | `src/components/Header.tsx:26-28` | Role detection uses `JSON.parse(session.roles)` without try/catch. If `roles` is malformed or already parsed, it crashes the entire header. | 🔴 |
| L2 | `src/components/Header.tsx:116-120` | Mobile nav items hardcode the same link classes as desktop but miss `isActive` highlighting — mobile users get no visual feedback for the current route. | 🟠 |
| L3 | `src/app/layout.tsx:74-75` | `<Header />` is rendered unconditionally inside `<UXProvider>`; admin layout (`admin/layout.tsx:46-89`) adds its own separate sidebar with `position: fixed`, creating two competing navigation layers on admin pages (Header + sidebar). | 🟠 |
| L4 | `src/components/Header.tsx:89` | Logout uses `window.location.href = "/"` (hard reload) instead of `router.push("/")`. This provides a poor UX with a full page flash. | 🟡 |
| L5 | `src/app/admin/layout.tsx:47-49` | Admin mobile sidebar uses CSS `translate-x-full` for hidden state. On desktop (`lg:static lg:translate-x-0`), it remains in the DOM flow. On very wide screens, this is correct, but there is no keyboard focus trap or ESC key handling for the mobile drawer. | 🟡 |
| L6 | `src/components/Header.tsx` | No `<nav aria-label="Main navigation">` on the desktop nav. Screen readers get no landmark distinction. | 🟡 |
| L7 | `src/app/admin/layout.tsx:19` | Admin sidebar `NAV_ITEMS` is missing the `reputation` and `withdrawals` pages (which exist at `/admin/reputation` and `/admin/withdrawals`). These routes are unreachable from the UI. | 🟠 |

### 2.2 Auth & Onboarding

| # | File | Issue | Severity |
|---|------|-------|----------|
| A1 | `src/app/login/page.tsx` | **No SMS code login tab** — only email/password form exists. The spec requires 3 tabs (phone SMS, password, WeChat). No WeChat QR login either. | 🔴 |
| A2 | `src/app/login/page.tsx` | **No 60-second countdown on any send-code button** (because there is no SMS tab at all). The spec explicitly demands a cooldown counter with visual feedback. | 🟠 |
| A3 | `src/app/login/page.tsx` | Login error handling maps only 2 Supabase messages to Chinese; all others pass through in English raw. | 🟡 |
| A4 | `src/app/register/page.tsx:148-193` | Role selection uses bare checkboxes with custom `<label>` styling. The "团队长" (team leader) role is missing from the 3-spec roles (only CUSTOMER + PROVIDER present). No visual card illustration/iconography per role. | 🟠 |
| A5 | `src/app/register/page.tsx` | No `role="radiogroup"` or `aria-describedby` on the role selector. Screen reader users get no group context. | 🟡 |
| A6 | `src/app/login/page.tsx:36` | Login redirect uses `window.location.href = "/dashboard"` instead of `router.push("/dashboard")`. Full page reload — session cookie sync is handled indirectly by the reload itself, but the UX is janky. | 🟡 |
| A7 | `src/app/login/page.tsx` | Registration success (`/login?registered=true` query param) is **not handled** — the login page ignores the param, so there is no success toast or banner telling the user their email was registered. | 🟡 |

### 2.3 AI Demand & Dual-panel Canvas

| # | File | Issue | Severity |
|---|------|-------|----------|
| D1 | `src/components/SplitDemandView.tsx:620-628` | Textarea is `rows={1}` with no auto-resize beyond single line. On mobile, the input feels cramped when typing longer descriptions. | 🟡 |
| D2 | `src/components/SplitDemandView.tsx:419-527` | Demo state animation has no fallback for users on slow devices or low-power mode — `setTimeout` chains can drift significantly if the tab is backgrounded. | 🟡 |
| D3 | `src/components/DynamicPricingCard.tsx` | The "一键采纳 AI 推荐预算" button is only shown when `priceStatus === "AUTO_RECOMMENDED"`. For all other statuses, there is no way to accept/use the suggested price — users must manually copy the number. | 🟠 |
| D4 | `src/components/VoiceInput.tsx:18-51` | Speech Recognition is initialized in the render path using a `ref` guard, but the check `typeof window !== "undefined"` runs every render. Better to defer to `useEffect`. | 🟡 |
| D5 | `src/components/VoiceInput.tsx:96-101` | ASR protocol extraction success shows a toast but no visual transition on the left protocol canvas (`extractedProtocol` state). Users must wait for the canvas to re-render, which feels disconnected. | 🟡 |
| D6 | `src/components/SplitDemandView.tsx:263` | The entire component wraps in `bg-zinc-950` (dark background) without respecting a light mode. Any text on this dark surface uses fixed `text-zinc-100`/`text-zinc-400` — these do NOT respond to `dark:` mode changes. The page is permanently dark (no light mode support). | 🟠 |
| D7 | `src/app/demands/new/page.tsx` | Uses `dynamic(() => import(...), { ssr: false })` correctly to avoid SSR issues with `useChat`. Loading state is the default Next.js spinner — no skeleton. | 🟢 |

### 2.4 Order Fulfillment & Chat

| # | File | Issue | Severity |
|---|------|-------|----------|
| O1 | `src/components/RealtimeChat.tsx:186-200` | Mobile keyboard push: The chat input is in a `border-t` footer inside a `flex-col h-full` container. When the keyboard opens on mobile, the viewport shrinks and the footer scrolls up with the page — but there is no `position: sticky` or `useEffect` with `visualViewport` API to handle the keyboard resize smoothly. **The input can be hidden behind the keyboard.** | 🔴 |
| O2 | `src/components/RealtimeChat.tsx:170-175` | Typing indicator ("对方正在输入...") uses an emoji `💬` rather than a styled animated dot pattern. This works but looks inconsistent with the more polished pulse-dot animation defined in `globals.css`. | 🟡 |
| O3 | `src/components/ProviderCheckinModal.tsx:132-133` | Modal uses `fixed inset-0 z-50 bg-black/80 backdrop-blur-sm`. On iOS Safari, `backdrop-blur` with `fixed` positioning can cause rendering glitches during scroll. | 🟡 |
| O4 | `src/app/orders/[id]/page.tsx:228-243` | The 4-step stepper uses `animate-pulse` on the **current step** ring (`isCurrent && ... animate-pulse`). A pulsing ring on every render of the active step is visually aggressive — users see a constant blinking ring. | 🟡 |
| O5 | `src/app/orders/[id]/page.tsx:394-401` | Payment channel buttons only show when `canPay && paymentChannels.length > 0 && !activePayment`. If `paymentChannels` is empty (still loading or not available), the user sees no payment UI and no loading indicator — just a blank area. | 🟠 |
| O6 | `src/components/ProviderCheckinModal.tsx:43-71` | GPS acquisition does not show a progress spinner during the 10-second `getCurrentPosition` timeout. If the GPS takes a long time, the user sees a static "获取现场 GPS" button with no feedback. | 🟡 |
| O7 | `src/app/orders/[id]/page.tsx:440-441` | SOS button is a plain `<Button variant="ghost">` with no confirmation dialog — one tap triggers the SOS flow. This could be dangerous for accidental taps. | 🟠 |

### 2.5 Design System & Consistency

| # | File | Issue | Severity |
|---|------|-------|----------|
| C1 | `src/app/globals.css` | **Color palette fragmentation:** The CSS uses `slate`, `zinc`, and `gray` color scales interchangeably. Header uses `slate-500`/`slate-900`, admin layout uses `zinc` for dark variants, `SplitDemandView` uses `zinc-950` backgrounds, and the login page uses `slate` again. This creates subtle but perceptible color inconsistencies across pages. | 🟠 |
| C2 | `src/app/globals.css:67-109` | The `:root` light mode uses `240deg` hue (zinc palette) for CSS variables, but many components hardcode `slate-` Tailwind classes (hue ~220). The dark mode `.dark` block correctly uses `240deg` hue. Result: in light mode, components using CSS variables (button, card, input from `ui/`) render in **zinc**, while components with hardcoded `slate-` classes render in **slate** — a visible hue shift. | 🔴 |
| C3 | `src/app/globals.css:155-186` | Custom scrollbar styles are only defined for WebKit (Chrome, Safari). Firefox (`scrollbar-width`) and Edge (non-WebKit Chromium) get no custom scrollbar. | 🟡 |
| C4 | Multiple files | **Dark mode gaps:** `SwipeableCard.tsx:94-95` uses `shadow-orange-100/60` in highlight mode with no `dark:` alternative. `landing/page.tsx` has incomplete dark mode coverage. | 🟠 |
| C5 | Multiple files | **Button states:** `ui/button.tsx` uses shadcn default styling with `active:scale-95` on some custom buttons (e.g., `SplitDemandView.tsx:357`, `RealtimeChat.tsx:195`) but not on standard shadcn `Button` components. Click feedback is inconsistent. | 🟡 |
| C6 | `src/components/Header.tsx:33-35` | Active nav link uses `bg-indigo-50 text-indigo-700` while inactive uses `text-slate-500`. The indigo/slate color contrast shift is correct, but the active background is very subtle (`bg-indigo-50` is ~95% white). Users may not easily distinguish the active tab. | 🟡 |
| C7 | `src/components/providers/UXProvider.tsx:6-12` | Error boundary fallback is a generic red text "页面发生异常，请刷新重试" — no branding, no action buttons, and no `role="alert"`. Screen readers won't announce the error. | 🟡 |
| C8 | `globals.css:214-228` | `breathing` and `pulse-dot` keyframes are defined but never referenced in the `@apply` or inline styles of any reviewed component. Dead animation code. | 🟡 |

---

## 3. Color Palette Audit Summary

| Component / Page | Light Hue | Dark Hue | Consistent? |
|-----------------|-----------|----------|-------------|
| Header (`header.tsx`) | `slate` + `indigo` | `zinc` + `indigo` | ❌ light=slate, dark=zinc |
| Login page | `slate` | `zinc` | ❌ same mismatch |
| Register page | `slate` | `zinc` | ❌ same mismatch |
| Dashboard | CSS vars (zinc) | CSS vars (zinc) | ✅ |
| Orders detail | CSS vars + `slate` | CSS vars + `zinc` | ❌ mixed |
| SplitDemandView | `zinc-950` (no light) | `zinc` | ✅ (fixed dark) |
| Admin layout | `slate` + CSS vars | `zinc` + CSS vars | ❌ mixed |
| Demands market | `zinc` | `zinc` | ✅ |

**Root cause:** `globals.css` CSS variables use `240deg` (zinc) for both light and dark, but many page-level components were written with hardcoded `slate-*` classes (from an earlier design choice). The two palettes coexist.

---

## 4. Responsive & Mobile Readiness

| Page | Mobile OK? | Keyboard? | Notes |
|------|-----------|-----------|-------|
| Landing (`/`) | ✅ | ✅ | Fluid grid, touch targets OK |
| Login | ✅ | ⚠️ | No keyboard type="tel" for phone tab (missing tab) |
| Register | ✅ | ✅ | Acceptable |
| Dashboard | ✅ | ✅ | Stats grid collapses to 1-col |
| Demands marketplace | ✅ | ✅ | 2-col → 1-col grid |
| SplitDemandView | ✅ | ✅ | `flex-col lg:flex-row` works |
| Orders detail | ✅ | ✅ | 2-col → 1-col, sidebar becomes bottom |
| Profile | ✅ | ✅ | Multi-column forms collapse |
| Chat (RealtimeChat) | ⚠️ | ⚠️ | **Keyboard pushes input off-screen** (O1) |
| Provider checkin modal | ✅ | ✅ | Full-screen overlay, fine |
| Admin pages | ✅ | ⚠️ | Sidebar drawer works, but no focus trap |

---

## 5. Remediation Roadmap

### Phase 1 — Critical (P0, 1-2 days)

| ID | Fix |
|----|-----|
| C2 | Unify color palette: Choose **one** hue family (`zinc-*` via CSS vars or `slate-*` hardcoded). Replace all `slate-*` classes in page components with `zinc-*` equivalents (or vice versa). |
| A1 | Add SMS code login tab with 60-second countdown button and WeChat QR login button (even if placeholder). |
| O1 | Add `visualViewport` event listener in `RealtimeChat` to scroll the input into view on mobile keyboard open. |

### Phase 2 — High (P1, 3-5 days)

| ID | Fix |
|----|-----|
| L1 | Add try/catch around `JSON.parse(session.roles)` in `Header.tsx:26`. |
| L3 | Add `data-admin-layout` attribute check in `Header.tsx` to suppress the global header on admin pages (admin layout has its own sidebar). |
| L7 | Add `/admin/reputation` and `/admin/withdrawals` to the `NAV_ITEMS` array in `admin/layout.tsx`. |
| A4 | Add "团队长" (TEAM_LEADER) role card to registration role selector. |
| D3 | Add "应用建议价" button for non-AUTO_RECOMMENDED statuses in `DynamicPricingCard.tsx`. |
| O5 | Add loading skeleton for payment channel section while `paymentChannels` is empty/loading. |
| C4 | Audit all components for missing `dark:` class variants. |
| C7 | Update `UXProvider.tsx` error boundary with branded fallback + "重试" button + `role="alert"`. |
| O7 | Add confirm dialog before SOS trigger. |

### Phase 3 — Medium (P2, 5-7 days)

| ID | Fix |
|----|-----|
| L2 | Add `isActive` state highlighting to mobile nav links in Header. |
| L5 | Add keyboard ESC handler and focus trap to admin mobile sidebar. |
| L6 | Add `aria-label` landmarks to desktop nav. |
| A2 | Add SMS send-code tab + 60s countdown with visual feedback. |
| A3 | Add full i18n mapping for Supabase auth error messages. |
| A5 | Add `role="radiogroup"` to role selector. |
| A7 | Handle `?registered=true` param on login page with success toast. |
| D1 | Add auto-resize behavior to single-row textarea (or increase default rows). |
| D5 | Add animated transition on left canvas when protocol is extracted from ASR. |
| O4 | Replace constant `animate-pulse` on stepper with one-time entrance animation. |
| O6 | Add loading spinner during GPS acquisition. |
| C1 | Standardize color scale across all components. |
| C3 | Add `scrollbar-width: thin` for Firefox. |
| C5 | Standardize button active state (`active:scale-95` or `active:scale-[0.98]`) across all buttons. |
| C6 | Increase active nav background opacity for better visual distinction. |

---

## 6. Summary

**Strengths:**
- Responsive layouts are well-executed across most pages (flex-col/grid collapse patterns)
- Skeleton loading states on dashboard, orders, demands marketplace
- Dark mode is supported in CSS variables and most component-level classes
- Error boundaries on orders, payment, demands, admin
- `touch-manipulation` and `touch-target` utility classes are consistently applied

**Critical weaknesses:**
1. **Color palette fragmentation** (hue shift between `slate` and `zinc`) is the most pervasive visual issue
2. **Missing login tabs** (SMS, WeChat) leaves auth flow incomplete
3. **Mobile chat keyboard occlusion** degrades the core communication feature on mobile
4. **Role detection fragility** in Header can crash the navigation entirely

**Total issues found: 35** (🔴 3 critical, 🟠 9 high, 🟡 23 medium).
