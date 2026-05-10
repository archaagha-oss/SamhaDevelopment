# UX Audit 2 — Findings & Implementation Plan

**Status:** Audit deliverable. **No code changes yet.** Implementation will follow in
PR-sized batches once this is signed off.

**Scope:** Projects, Units, Leads, Deals, plus the missing "My Day" home.

**Lens:** Placement (F-pattern), Density, Workflow (a real agent's day), Conventions
(Salesforce / HubSpot / Pipedrive baseline).

---

## Preamble

### First-audit reference

The brief asks me to fold in the first audit's findings (U1–U12, P1–P7, L1–L8, D1–D12)
"by ID when consolidating." I searched the repo for any committed markdown that uses
that ID format and **no such file exists**. The closest committed audit material is
`UI_AUDIT_SUMMARY.md`, `COMPLETE_UX_REDESIGN_SUMMARY.md`, `WIREFRAME_GAP_ANALYSIS.md`,
`PHASE_A_UXUI_SUMMARY.md` — none use those IDs.

Where this audit's findings overlap a likely first-audit theme (duplication,
sub-page sprawl, redundant tabs), I call that out as **[likely first-audit overlap]**
rather than fabricating an ID. If the first audit lives in a non-committed source
(Notion, etc.), please paste the IDs and I will retrofit them into Part G.

### Methodology

Five parallel evidence streams, every claim cites `path:line`:

1. R1 + R2 sweep — emojis, non-lucide icons, hard-coded icon colors
2. R3 + R4 sweep — `AED` literals, date rendering patterns
3. R5 + R6 + R7 — confirmation dialogs, primary-CTA placement, sticky slim headers
4. My Day — routing, role enum, endpoint gap analysis
5. Detail-page block inventories — Lead, Deal, Unit, Project

### Counts at a glance

| Rule | Violations | Files affected |
| --- | ---: | ---: |
| R1 — emojis in UI | 188 occurrences | ~95 files |
| R2.1 — non-lucide raw `<svg>` | 2 | 2 files |
| R2.2 — hex/rgb on icons | 0 | 0 |
| R2.3 — hard-coded tailwind color on icons | 0 | 0 |
| R3 — `AED` text literals | 199 | ~70 files |
| R4 — relative dates leaked into details | 6 components | 5 files |
| R4 — absolute dates leaked into lists | 1 | 1 file |
| R5 — confirms misclassified as destructive | 7 of 20 | 7 files |
| R5 — `window.confirm` instead of `ConfirmDialog` | 5 | 5 files |
| R6 — primary CTA missing/wrong-position | 4 of 4 detail pages | 4 |
| R7 — sticky slim header missing | 4 of 4 detail pages | 4 |

---

# PART A — Global Hard Rules (R1–R7)

Each rule below lists the **fix shape** (one sentence), the **files touched** (grouped),
and a **per-file diff plan**. No code yet — list of diffs only.

---

## R1 — No emojis anywhere

**Fix shape.** Every emoji in `apps/web/src/**` is replaced by a `lucide-react` icon
sized via Tailwind class (`size-3`, `size-4`, `size-5`) and colored with a design token
(`text-primary`, `text-success`, `text-warning`, `text-destructive`, `text-info`,
`text-accent-2`, `text-muted-foreground`).

**Patterns.** Most violations are in icon-map constants (`CHANNEL_ICON`, `NOTIF_ICONS`,
`TYPE_ICON`, `LEAD_SOURCE_ICON`) shared across components. Fixing the **map** fixes every
consumer. The remaining violations are inline literals in JSX (e.g. `🔒 Reserve Unit`).

### R1.A — Centralized icon maps to convert (highest leverage)

These maps are referenced from many components. Migrate the map first, then sweep
inline literals.

| File | Lines | Map name | Replacement strategy |
| --- | --- | --- | --- |
| `components/AppShell.tsx` | 44–52 | `NOTIF_ICONS` (notification type → emoji) | Map `NotificationType` → lucide component (`CreditCard`, `Clock`, `DollarSign`, `ClipboardList`, `RefreshCw`, `User`, `Bell`). Render `<Icon className="size-4 text-{token}" />` keyed by type. |
| `components/ConversationThread.tsx` | 28–35 | `CHANNEL_ICON` (activity type → emoji) | `Mail`, `MessageCircle`, `Smartphone`, `Phone`, `Handshake`, `Building2`, `FileText`, `RefreshCw`. |
| `components/DealActivityPanel.tsx` | 25–36 | (inline switch) | Same lucide set as above + `Lock`, `File`, `CheckCircle2`, `Home`. |
| `components/DealTimeline.tsx` | 13–17 | step icons | `Lock`, `ClipboardList`, `Sparkles`, `CheckCircle2`. |
| `components/LeadProfilePage.tsx` | 73–74 | activity-type icon map | `Phone`, `Mail`, `MessageCircle`, `Handshake`, `Building2`, `FileText`. |
| `components/LeadsPage.tsx` | 63–68 | `LEAD_SOURCE_ICON` (source → emoji) | `Smartphone`, `Handshake`, `Globe`, `Users`, `MessageCircle`, `Footprints`. |
| `components/TaskDashboard.tsx` | 21 | task-type icon map | `Phone`, `Handshake`, `RefreshCw`, `File`, `CreditCard`. |
| `components/UnitActivityLogger.tsx` | 30–38 | activity-type icon map | `Phone`, `Home`, `FileText`, `Mail`, `MessageCircle`, `Handshake`, `Search`, `Wrench`, `Video`. |
| `components/ShareUnitModal.tsx` | 29 | channel icon | `Mail`, `MessageCircle`, `Smartphone`. |
| `components/ActivityModal.tsx` | 16–21 | activity-type icon | `Phone`, `MessageCircle`, `Mail`, `Calendar`, `Building2`, `FileText`. |
| `components/OqoodCountdown.tsx` | 22–25 | severity icon | `CheckCircle2`, `AlertTriangle`, `Circle`, `XCircle`. |
| `components/DocumentBrowser.tsx` | 36–39 | doc-type icon | `FileText`, `ClipboardList`, `Image`, `Paperclip`. |
| `pages/HotInboxPage.tsx` | 31 | channel icon | `Mail`, `MessageCircle`, `Smartphone`. |

Once these maps return real components instead of strings, every consumer that does
`{NOTIF_ICONS[n.type] ?? "🔔"}` becomes `<Icon className="…" />`. **A handful of map
fixes resolves ~120 of the 188 occurrences.**

### R1.B — Inline emoji literals in JSX

68 remaining inline literals. Grouped by rationale:

**Action buttons (label prefix emoji):** `🔒 Reserve Unit`, `📄 Generate Sales Offer`,
`📑 Generate SPA Draft`, `✓ Mark SPA Signed`, `💰 Record Next Payment`, `🏠 Mark Handed Over`,
`📞 Call`, `✉ Email`, `💬 WhatsApp`, `📷 Photo`, `📐 Floor plan`, `💬 Share with lead`,
`📨 Send Reminder`, `🔔 Pause Reminders`.

→ Replace prefix with a lucide icon adjacent to the label inside the button (icon +
text pattern). Pattern: `<Lock className="size-4" /> <span>Reserve Unit</span>` inside
a flex button. Files: `components/DealDetailPage.tsx:733,771,780,789,797,808,1230,2140-2166`,
`components/LeadProfilePage.tsx:594,602,612`, `components/UnitDetailPage.tsx:194,238,623`,
`components/UnitGallery.tsx:107`, `components/UnitsTable.tsx:483,594,706`,
`components/PaymentReportPage.tsx:344`.

**Inline check / cross / circle (form & status states):** `✓` and `✓ Approve` and
`✓ Saved` and `{done ? "✓" : i + 1}`.

→ Replace with `<Check className="size-3 text-success" />`. Step indicators (e.g. wizard
"step done") use `<CheckCircle2 className="size-5 text-success" />` instead of glyph.
Files: `components/BrokerOnboarding.tsx:97,200,540,548-550`,
`components/CommissionDashboard.tsx:250`, `components/CommissionUnlockStatus.tsx:54,69`,
`components/DealDetailPage.tsx:1150,1681,1754,1759,1775,1781`,
`components/DealReadinessIndicator.tsx:56,78`, `components/DealStepper.tsx:60`,
`pages/DealCreatePage.tsx:185,244,319,396`, `pages/UnitsBulkPage.tsx:301`,
`components/finance/OverdueAlertsTable.tsx:86`, `components/finance/UpcomingPaymentsTimeline.tsx:80`,
`components/broker/PendingApprovalsQueue.tsx:67,99`, `pages/SettingsPage.tsx:1097,1715,1775`,
`pages/ActivitiesPage.tsx:122`, `components/ReceiptPrintPage.tsx:143` (PRINT — keep
`<Check>` only inside on-screen preview; print uses no icon).

**Empty-state / decorative:** `🎉 Nothing waiting…`, `🎉 Nothing expiring…`, `📭`,
`🏚️` (404), `📸 No images added yet`, `✓ No overdue payments`, `✓ No pending approvals`,
`✓ No upcoming payments`.

→ Use `<Sparkles>` (positive empty) or `<Inbox>` (neutral empty) or
`<AlertCircle>` (404 missing) at `size-12 text-muted-foreground` above the message.
Files: `pages/HotInboxPage.tsx:108`, `pages/CompliancePage.tsx:163`,
`components/EmptyState.tsx:14`, `components/NotFoundPage.tsx:10`,
`components/UnitModal.tsx:225`, `components/finance/OverdueAlertsTable.tsx:86,177`,
`components/broker/PendingApprovalsQueue.tsx:67`,
`components/finance/UpcomingPaymentsTimeline.tsx:80`.

**Severity / alert markers:** `⚠️`, `🚨`, `⏰`, `🔴`, `❌`.

→ `<AlertTriangle>` (warning), `<AlertCircle>` (destructive),
`<Clock>` (deadline), `<XCircle>` (failure). Token: `text-warning` /
`text-destructive` / `text-info`. Files: `components/DealDetailPage.tsx:2317`,
`components/DealTimeline.tsx:126`, `components/ExecutiveDashboard.tsx:361`,
`components/FinanceDashboard.tsx:264,270,276,318,369`,
`components/UnitDetailPage.tsx:461`, `components/OqoodCountdown.tsx:85`,
`components/finance/ExpectedVsReceivedChart.tsx:87`.

**Misc decorations to delete (no information value):** `📌` (line 212 of
`ActivityModal.tsx` — pure decoration), `👁️` (preview), `🗑️` (delete — replace with
`<Trash2 className="size-4" />`), `👑` (top-performer crown — replace with `<Crown>`),
`🔍` (search — replace with `<Search>` already in use elsewhere),
`📸` (camera).

Full per-file inline list is captured in Part F (sweep).

### R1.C — Out of scope: print pages, README

**Keep emoji-free** (already): the SVG-rendered print pages (`SalesOfferPrintPage`,
`SpaDraftPrintPage`, etc.). They have no emojis today and should stay that way.

**Out of scope for the UI sweep:** server-side strings (toast templates returned from
backend), `apps/api/src/**`. The brief says "find every emoji in apps/web/" — limited
to the web app.

---

## R2 — Icons only from lucide-react, colored by token

### R2.1 Non-lucide / raw `<svg>` violations

| File | Line | Current | Replacement |
| --- | --- | --- | --- |
| `components/FeatureFlagGate.tsx` | 33 | inline raw `<svg>` lock | `<Lock className="size-5 text-muted-foreground" />` |
| `components/DocumentUploadModal.tsx` | 194 | inline raw `<svg>` upload glyph | `<Upload className="mx-auto mb-3 size-12 text-muted-foreground" />` |

### R2.2 / R2.3 Color violations on icons

**Zero findings.** Icons in the codebase already inherit `currentColor` and rely on
parent `text-*` classes. No hex / rgb literals on icon elements, no hard-coded Tailwind
color classes on lucide components. **Note this as already-compliant.**

### R2 follow-up (post-sweep)

After R1.A swaps emoji-strings for components, sweep again for `text-red-*`,
`text-blue-*`, `text-green-*`, `text-yellow-*`, `text-orange-*` *adjacent to icon
JSX* — there's a real risk new violations land during R1 if implementers reach for
ad-hoc Tailwind colors instead of tokens. Add a lint rule:

```
// eslint custom rule (or just CI grep): forbid hard-coded color classes on lucide imports.
// Pattern: <(lucide-import-name) ... className=".*text-(red|blue|green|yellow|orange)-.*"
```

---

## R3 — Currency rendering: `<DirhamSign />`

### Status of existing helper

`apps/web/src/utils/format.ts:15-29` defines `formatCurrency()` returning
`` `${currency} ${formatted}` ``. **No file imports it.** The actual rendering happens via
inline ``AED ${value.toLocaleString()}`` literals in 199 places.

A separate `formatAED()` exists per-print-page (e.g. `SalesOfferPrintPage.tsx:25`,
`OfferPrintPage.tsx:28`, `ReservationFormPrintPage.tsx:28`, `ReceiptPrintPage.tsx:20`,
`SpaDraftPrintPage.tsx:124`) — these are scoped to their print component and stay as
text-only "AED 1,250,000" per the brief's print-context exception.

### Fix shape

1. **New component** `apps/web/src/components/ui/DirhamSign.tsx` — inlined SVG, paths
   inheriting `currentColor`, `1em` width/height, `role="img"`, `aria-label="UAE dirham"`.
   Sourced from the official 2023 UAE Central Bank symbol on Wikimedia
   (`File:Dirham_Sign.svg`, public domain). Saved at
   `apps/web/src/assets/dirham.svg` for record, but the React component inlines the
   path directly so it inherits color without needing `<img>`.

2. **New helper** `apps/web/src/lib/money.tsx` exporting `formatDirham(value, opts)`
   that returns a JSX fragment `<><DirhamSign className="…" /> {formatted}</>`.
   Keeps a separate `formatDirhamCompact(value)` for kanban cards (returns "1.25M" /
   "240k"). Both honor `decimals` and `null → "—"`.

3. **Sweep replace** every inline `` `AED ${n.toLocaleString()}` `` and
   `<>AED {n.toLocaleString()}</>` with `formatDirham(n)` in display contexts.
   Inputs get a leading SVG adornment in the input's left padding; the AED text in the
   `<label>` is removed (the symbol carries the meaning).

### Sweep plan — DISPLAY contexts (110 occurrences)

Every site where AED is rendered as on-screen value. Group by file (R3.2 from
sweep). For each, the diff is identical: `` `AED ${value.toLocaleString()}` `` →
`{formatDirham(value)}` and the surrounding template-string is split if needed.

Critical hot-spots (≥3 occurrences per file):

- `components/LeadProfilePage.tsx` — 731, 732, 863, 934, 964, 1006, 1183, 1192, 1253, 1262
- `components/DealDetailPage.tsx` — 929, 969, 1202, 1267, 1268, 1269, 1270, 1321, 1735, 1830
- `components/UnitDetailPage.tsx` — 264, 323 (input), 345, 357
- `components/DealsKanban.tsx` — 240
- `components/UnitModal.tsx` — 205, 250, 255, 266, 503
- `components/UnitMatrixGrid.tsx` — 51, 58
- `components/CreateOfferModal.tsx` — 226, 241, 250, 271, 276, 305, 310
- `components/finance/*.tsx` — 9 files with chart-tooltip and table-cell AED
- `pages/DealCreatePage.tsx` — 317, 357, 362, 367, 431, 567
- `pages/EscrowPage.tsx` — 124, 128, 132
- `pages/ReportsPage.tsx` — 67, 327
- `components/ExecutiveDashboard.tsx` — 8 occurrences (241, 247, 265, 383, 396, 463, 608, 720)

Full file:line list lives in Part F.

### Sweep plan — INPUT contexts (36 occurrences)

`<label>Amount (AED) *</label>` → `<label>Amount</label>` and the input wraps with a
leading `<DirhamSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />`
inside a `<div className="relative">`. Bonus: input padding-left increases to make
room (`pl-9`).

Files: `LeadProfilePage.tsx:1274,1278,1283,1340,1350`,
`ProjectSettingsPage.tsx:408,483`, `DealDetailContent.tsx:284`,
`UnitInterestPicker.tsx:119,129`, `UnitMatrixGrid.tsx:252,267`,
`UnitsTable.tsx:511,521,558,559,654`, `UnitDetailPage.tsx:323`,
`CreateOfferModal.tsx:259`, `BrokerPage.tsx:464`, `PaymentActionModal.tsx:189,227`,
`CommissionDashboard.tsx:270`, `pages/DealCreatePage.tsx:330,342`,
`pages/DealEditPage.tsx:221,234`, `pages/UnitEditPage.tsx:312,385`,
`pages/UnitTypePlansPage.tsx:123` (table column key), `pages/LeadEditPage.tsx:458`,
`pages/UnitsBulkPage.tsx:376,416,454`, `pages/PaymentPlanEditPage.tsx:269`.

`UnitsTable.tsx:558-559` ("AED Delta", "Set Fixed AED") and
`pages/UnitsBulkPage.tsx:416` ("+/− AED") are select-option labels — keep "AED" text
since the option distinguishes from "%". Don't swap there.

### Sweep plan — PRINT contexts (KEEP, no changes)

Per the brief, print-and-legal pages keep ISO text. **No-op** for:
`SalesOfferPrintPage.tsx`, `SpaDraftPrintPage.tsx`, `ReservationFormPrintPage.tsx`,
`ReceiptPrintPage.tsx`, `OfferPrintPage.tsx`, `InvoicePrintPage.tsx` (if exists; not
yet confirmed in repo — check during implementation).

### Sweep plan — ARIA contexts

Zero existing aria-labels with "AED". When `formatDirham()` renders the symbol, wrap
the value group with `aria-label="{value} UAE dirham"` so screen readers say "one
million two hundred fifty thousand UAE dirham" instead of "one million two hundred
fifty thousand". The `DirhamSign` itself is `role="img" aria-hidden="true"` when
rendered inside a labeled group (avoids double announcement); standalone it uses
`aria-label="UAE dirham"`.

### Documentation

Add `apps/web/src/components/ui/README.md` (new file) listing the UI primitives:
`Button`, `Input`, `Badge`, `DirhamSign`, etc. with one-line usage. Confirm no
README exists today.

---

## R4 — Relative dates in lists, absolute in details

### Helper module

`apps/web/src/utils/format.ts` exposes `formatDate()` and `formatDateTime()`. **No
`formatRelative()` exists.** Two ad-hoc relative-date helpers are scattered:

- `LeadProfilePage.tsx:89-92` — `timeAgo()` private helper
- `DealDetailPage.tsx:89-90` — same shape, copied
- `DealActivityPanel.tsx:42-45` — same shape, copied
- `ConversationThread.tsx:62-65` — same shape, copied

→ **Consolidate**: add `formatRelative(date)` to `utils/format.ts` returning
"today", "yesterday", "Xd ago", "in Xd". Remove the four private copies.

### R4 violations — relative in lists (should be relative ✓)

`LeadsPage.tsx:538` already uses relative ("Today", "Xd ago"). **Compliant.** The
sweep agent flagged this as a violation but the rule wants relative in lists — keep
it. (Reclassify as compliant.)

### R4 violations — relative in details (should be absolute)

The detail pages render relative ("12d ago", "Today"). They should render
absolute ("Mar 5, 2026 · 3:42 PM").

| File | Line | Context | Fix |
| --- | --- | --- | --- |
| `LeadProfilePage.tsx` | 744 | "Last Contact" KPI uses `timeAgo()` | `formatDateTime(latest.activityDate)` |
| `DealDetailPage.tsx` | 1309 | "Reminded {timeAgo(p.lastReminderSentAt)}" | `Reminded on {formatDate(p.lastReminderSentAt)}` |
| `ConversationThread.tsx` | 62-65 | Used by both Lead & Deal detail; renders "5m ago" / "Yesterday" | Replace with `formatDateTime` for any timestamp ≥ 1 day old; allow short relative ("just now" / "Xm ago") only for ≤ 60min — that's CRM-conventional for activity feeds. |
| `DealActivityPanel.tsx` | 42-45 | Same 1-line `timeAgo()` pattern | Same as ConversationThread fix. |

The "≤60min stays relative" carve-out matches HubSpot / Salesforce — fully relative
dates in detail timelines are confusing for old activities.

### R4 violations — raw ISO leaks

**Zero.** All `.toISOString()` calls go through formatters or API requests.

---

## R5 — Confirmations only for true destructions

### Toast infrastructure

`main.tsx:5,31-36` initializes **sonner** as the toast lib at `position="bottom-right"`
with `duration: 4000`. **Sonner natively supports** `toast(msg, { action: { label, onClick } })`
which is exactly what the "Undo" pattern needs. **No code changes to the lib.**

Build a tiny helper at `apps/web/src/lib/optimisticToast.ts`:

```
optimisticAction({
  do: () => Promise<T>,           // optimistic UI update + server call
  undo: () => Promise<void>,      // server-side reversal
  message: string,                // "Lead moved to QUALIFIED"
  undoWindowMs?: number,          // default 5000
})
```

It runs `do()` immediately, shows a 5-second sonner toast with an Undo button. If
Undo fires within the window, calls `undo()`. After the window expires, no-op.

### Misclassified — convert to optimistic + undo (7 files)

| File | Line | Current action | Replace with |
| --- | --- | --- | --- |
| `components/LeadProfilePage.tsx` | 440 | ConfirmDialog: "Create deal from offer acceptance" | Optimistic create + undo (cancel deal within 5s) |
| `components/DealDetailPage.tsx` | 2227-2235 | ConfirmDialog: stage move | Optimistic move + undo (revert stage) |
| `components/DealDetailPage.tsx` | 2140-2166 | Per-stage CTAs that pop a ConfirmDialog | Same — optimistic + undo (each CTA already has a known reverse path) |
| `components/PaymentPlansPage.tsx` | 326-336 | ConfirmDialog: deactivate / reactivate plan | Optimistic toggle + undo (flip flag) |
| `pages/MemberDetailPage.tsx` | 51 | `window.confirm`: deactivate member | Optimistic deactivate + undo (data preserved) |
| `pages/NotificationPreferencesPage.tsx` | 79 | `window.confirm`: clear all overrides | Optimistic clear + undo (re-apply snapshot) |

### Native `window.confirm` → `ConfirmDialog` (5 files, all true destructions, keep confirm)

| File | Line | Action | Migration |
| --- | --- | --- | --- |
| `components/DocumentBrowser.tsx` | 85 | Delete document | Replace with `ConfirmDialog` (keep confirm — file is gone) |
| `components/UnitShareLinkPanel.tsx` | 137 | Delete share link | Replace with `ConfirmDialog` |
| `components/ProjectDocumentsTab.tsx` | 131 | Delete project document | Replace with `ConfirmDialog` |
| `components/ProjectUpdatesTab.tsx` | 123 | Delete update | Replace with `ConfirmDialog` |
| `pages/UnitTypePlansPage.tsx` | 76 | Delete type plan | Replace with `ConfirmDialog` |

### Already-correct destructive confirms (keep as-is)

`LeadsPage.tsx:559-567` (delete lead), `LeadProfilePage.tsx:1410-1418` (delete lead),
`BrokerPage.tsx:870-878` (delete broker), `BrokerPage.tsx:879-887` (remove agent),
`ContactsPage.tsx:345-363` (delete / bulk delete contact),
`ContactDetailPage.tsx:208-216` (delete contact), `SettingsPage.tsx:1542` (revoke API key),
`HotInboxPage.tsx:145` (discard message — no undo available),
`QuickLeadModal.tsx:29` (discard draft — unsaved work).

---

## R6 — Primary "Next step" CTA top-right and sticky

### Per-page status (from R5/R6/R7 sweep)

| Detail page | Current next-step UI | Position | Sticky? | Verdict |
| --- | --- | --- | --- | --- |
| Lead | Stage badge dropdown popover at `LeadProfilePage.tsx:625-662` | Header (inline) | No | **Wrong** — popover is hidden, no persistent CTA |
| Deal | Header CTA bank `DealDetailPage.tsx:763-820` + bottom-sticky bar `2172-2185` | Bottom | Sticky **bottom** | **Wrong position** — should be top-right |
| Unit | None | — | — | **Missing entirely** |
| Project | "Edit" only (`ProjectDetailPage.tsx:185`) | Top-right | No (in sticky parent) | **No next-step action** |

### Fix shape

Introduce a shared `<NextStepCard />` primitive at
`apps/web/src/components/ui/NextStepCard.tsx`:

```
<NextStepCard
  label="Move to QUALIFIED"
  description="Last activity 4d ago — agent recommends qualifying call"
  onClick={...}
  variant="primary | accent | success"
  secondary?: { label, onClick }     // e.g. "Skip stage"
  metadata?: { label, value }[]      // e.g. "Stalled 12d", "Reservation expires 2d"
/>
```

Mounts inside a sticky right-rail container that lives **outside** the main scroll
column so it stays visible:

```
<div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
  <main className="overflow-hidden">{/* scrolls */}</main>
  <aside className="lg:sticky lg:top-4 lg:self-start">
    <NextStepCard ... />
    {/* below: context blocks (contact, KYC, related entities) */}
  </aside>
</div>
```

`lg:sticky lg:top-4 lg:self-start` keeps it pinned at the top of the right rail as the
main column scrolls.

### Per-page application

- **Lead:** Remove popover; promote stage-transition into NextStepCard at top of right
  rail. Card body mirrors current popover options ("Move to QUALIFIED",
  "Move to CLOSED_LOST"). Below-the-fold tabs unchanged.
- **Deal:** Move existing bottom-sticky CTA (`2172-2185`) to NextStepCard at top of
  right rail. The stage-specific CTA bank (`763-820`) collapses into the secondary
  action slot, or reduces to a single "primary next action" determined by stage
  (Reserve / Generate Sales Offer / Mark Signed / Record Payment / Mark Handed Over).
- **Unit:** Add NextStepCard with status-driven action: AVAILABLE → "Block",
  ON_HOLD → "Release", BLOCKED with expired hold → "Auto-released",
  RESERVED → "Open active deal".
- **Project:** Add NextStepCard with lifecycle action — pre-launch projects
  → "Launch project", post-launch with vacant inventory → "Add unit", at-handover-90d
  → "Begin handover process".

### Mobile (<768px)

Right rail collapses below main. NextStepCard becomes a sticky bottom bar (`fixed
inset-x-0 bottom-0`) on mobile only — the same pattern Pipedrive uses. Keeps top-
right priority on desktop and one-thumb access on mobile.

---

## R7 — Sticky slim header on long detail pages

### Per-page status

| Detail page | Sticky element today | Slim? | Has entity ID? | Has stage badge? | Has next CTA? |
| --- | --- | --- | --- | --- | --- |
| Lead | None | — | — | — | — |
| Deal | Bottom bar `2172-2185` | No (full-width bottom strip) | No (only stage label) | No | Yes (button) |
| Unit | `UnitHeader` is sticky in flow but doesn't slim | No | Yes | Yes | No |
| Project | Full sticky header `160-274` (KPI strip + tabs) | **No — full-height, never collapses** | Yes (name) | Yes (status badge) | No (Edit only) |

### Fix shape

A new `<SlimHeader />` primitive in `components/ui/SlimHeader.tsx`. Uses
`IntersectionObserver` on a sentinel placed at the bottom of the full header. When the
sentinel scrolls out of view, the slim header slides in from the top (`fixed top-0
inset-x-0 z-40 h-12 bg-card border-b shadow-sm`).

Slim header contents (left → right):

```
[← Back]  Entity#ID · Key context · [Stage badge]                      [Next CTA]
```

### Per-page application

- **Lead:** New SlimHeader showing `← Back · Lead-ID · Phone · [Stage] · [Next step]`.
- **Deal:** Replace the bottom strip with a top SlimHeader showing
  `← · Deal-# · Buyer · Unit · [Stage] · [Next CTA]`. The bottom strip is deleted.
- **Unit:** SlimHeader showing `← · Unit-# · Project · [Status badge] · [Next CTA]`.
- **Project:** Convert the existing top-sticky to a two-mode header — full-height
  initially, collapses to slim (`h-12`, KPI strip and tab nav hidden) when scrolled
  past 200px. Tab nav re-pins below the slim header so navigation stays accessible.

### Mobile (<768px)

Slim header stays fixed at top but drops the description column; only `← · Entity-ID ·
[Stage] · [CTA]` survives.

---

# PART B — The Missing "My Day" Home

## What exists today

`router.tsx:108` — root path `/` renders `<ExecutiveDashboard />` for **all roles**.
`ExecutiveDashboard.tsx:128` is org-wide: pipeline value, agent leaderboard,
collections aging — designed for managers/admins. A MEMBER agent loading `/` sees
the org dashboard, not their personal queue.

Frontend role enum lives at `AppShell.tsx:15` (`ADMIN | MANAGER | MEMBER | VIEWER`)
and is read from localStorage (`localStorage.getItem("samha:role")`) at line 76.
Backend role enum at `prisma/schema.prisma:116-121` matches.

## Routing change

Promote `<MyDayPage />` to the index route for `MEMBER` and `VIEWER`. ADMIN and MANAGER
keep ExecutiveDashboard at `/dashboard` and have a sidebar link to `/my-day` for
quick access.

```
router.tsx changes (proposed):
  / → <RoleAwareHome>     // new wrapper
  /dashboard → <ExecutiveDashboard>
  /my-day → <MyDayPage>

<RoleAwareHome> dispatches to <MyDayPage> for MEMBER/VIEWER, <ExecutiveDashboard> otherwise.
```

## Layout (desktop ≥1024px)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  STRIP (full width):                                                               │
│  6 calls due  ·  3 follow-ups overdue  ·  2 deals stalled  ·                       │
│  [DirhamSign] 240k due this week  ·  [refresh]                          [bell]    │
├──────────────────────────────────────────────────┬─────────────────────────────────┤
│  ACTION QUEUE (col-span 2)                       │  PIPELINE PULSE                 │
│  ──────────────────────                          │  ────────────────               │
│  [today filter] [overdue] [silent leads]         │  Mini kanban summary            │
│                                                  │  NEW       12 · 1.2M            │
│  [icon] John Doe · Call due · 2h overdue         │  CONTACTED  8 · 800k            │
│  [Call] [Log] [Snooze 1d/3d/1w]                  │  QUALIFIED  6 · 1.8M            │
│                                                  │  VIEWING    4 · 1.5M            │
│  [icon] Aisha Khan · Follow-up · today           │  PROPOSAL   3 · 950k            │
│  [Call] [Log] [Snooze]                           │  NEGOTIATE  2 · 600k            │
│                                                  ├─────────────────────────────────┤
│  [icon] Mohammed S · 8 days silent               │  HOT INBOX                      │
│  [Call] [Log]                                    │  ──────────                     │
│                                                  │  [icon] +971 5x… · WhatsApp     │
│  [icon] Payment due · DL-1042 · 50k              │       "Hi, interested in 2BR"   │
│  [Mark Paid] [Send Reminder] [View Deal]         │       2h ago · [Triage]         │
│                                                  │                                 │
│  ...up to 50 rows, virtualized                   │  [icon] info@... · Email        │
│                                                  │       "Bayut inquiry"           │
│                                                  │       4h ago · [Triage]         │
│                                                  │                                 │
│                                                  │  +3 more →                      │
└──────────────────────────────────────────────────┴─────────────────────────────────┘
```

## Layout (tablet 768–1023)

Right column drops below action queue. Strip stays full width.

## Layout (mobile <768)

Strip becomes horizontal scroll of pill metrics. Action queue is the page; pipeline
+ hot inbox become tabs reachable via a `[Pipeline] [Inbox]` segmented control above
the queue.

## Block-by-block spec

### 1. Top strip — `<MyDayStrip />`

Single horizontal strip, ≤ 56px tall. Each metric is a click target → filters the
action queue below.

| Metric | Source | Click action |
| --- | --- | --- |
| `N calls due` | tasks.assignedToId=me, type=CALL, dueDate ≤ today, status=PENDING | filter queue to type=CALL |
| `N follow-ups overdue` | activities.createdBy=me, followUpDate ≤ now (no completed-marker), enriched join | filter to follow-ups |
| `N deals stalled` | deals where assignedAgent=me + stage in [RESERVATION_PENDING, SPA_PENDING, OQOOD_PENDING] AND stage age > stageMaxDays | filter to stalled |
| `<Dirham> Xk due this week` | payments where dealAgent=me + dueDate within 7d + status in PENDING/PARTIAL/OVERDUE | filter to payments |

### 2. Action queue — `<ActionQueue />`

Single feed, virtualized. Row composition:

```
[type-icon] [name/title] [staleness chip] [time-of-day or "Xd overdue"]
            [Call] [Log] [Snooze 1d/3d/1w] [Reassign]
```

- Type icon distinguishes Task / Follow-up / Silent lead / Payment due (lucide:
  `Phone`, `Bell`, `Clock`, `CreditCard`).
- Click row → navigate to relevant Lead or Deal detail.
- Inline quick actions never navigate — they fire optimistic toasts (R5).
- Snooze writes the new `dueDate` and reorders.
- Sort: due-time ascending; overdue items pinned to top in red.

### 3. Pipeline pulse — `<PipelinePulse />` (right col top)

Mini kanban: count + value per stage, scoped to deals where agent = me. Click stage
→ navigate to `/deals?assignedAgent=me&stage=X`.

### 4. Hot inbox preview — `<HotInboxPreview />` (right col bottom)

Last 5 unmatched inbound messages from `triage` (channel, from, snippet, age).
Each row → triage page detail. "+N more →" link → full triage list.

## Endpoint gap analysis

The brief requires 7 feeds (A–G). Audit results:

| # | Feed | Today | Required | Gap |
| --- | --- | --- | --- | --- |
| A | Tasks due today / overdue (mine) | `GET /api/tasks?assignedToId=&dueBefore=` exists at `tasks.ts:6` | `GET /api/my-day/tasks` (new alias, no params needed) | Add wrapper or keep client-side filtering — wrapper preferred (1 round-trip) |
| B | Overdue follow-ups (mine) | `GET /api/activities?createdBy=&dateFrom=` partial at `activities.ts:6` | Need filter `followUpDate <= now AND not completed` | Add server-side filter or new endpoint |
| C | Silent leads (mine, no activity 7+d, open) | None | New endpoint | **Missing** |
| D | Payments due this week | `GET /api/reports/payments` org-wide at `reports.ts:87` | Filter by `deal.assignedAgent = me` | Add `?assignedAgent=me` parameter |
| E | Pipeline pulse (deals by stage, mine) | `GET /api/reports/deals/by-stage` org-wide at `reports.ts:371` | Filter by agent | Add `?assignedAgent=me` parameter |
| F | Hot inbox (last 5 unmatched) | `GET /api/triage?status=UNCLAIMED&limit=5` at `triage.ts:41` | ✓ | None |
| G | Strip aggregate counts | None — `/api/reports/dashboard/summary` is org-wide | Single aggregate `GET /api/my-day/summary` returning all counts | **Missing** — add this |

### Recommended new endpoints

1. **`GET /api/my-day/summary`** → returns `{ callsDue, followUpsOverdue, dealsStalled, paymentsDueWeek, paymentsDueWeekTotal }` for the current user. Powers the strip in one round-trip.
2. **`GET /api/my-day/queue`** → returns the merged feed (tasks ∪ follow-ups ∪ silent ∪ payments) sorted by urgency, paginated. Powers the action queue without 4 separate calls + client merge.
3. **Lead model query** for "silent leads": needs a denormalized `lastContactedAt` column on Lead (today computed via groupBy at `leads.ts:66-74`). Fastest path — add the column and a `lastActivityAt` migration trigger, OR keep the groupBy approach in the new `/my-day/queue` endpoint. Migration is cleaner and reusable for kanban staleness colors (D4).

### SSE channel for live updates

`sseHub.ts` already supports `publishToUser(userId, event, data)`. Subscribe `MyDayPage`
to `my-day:<userId>` channel; backend publishes on:
- new task assigned to user
- payment status changed for deal owned by user
- inbound message routed to user's queue
- lead stage changed for lead assigned to user

Channel naming convention used elsewhere is `<resource>.<action>` (e.g.
`triage.updated`); pick `my-day.refresh` as a coarse hint, page calls
`/my-day/summary` again on receipt.

---

# PART C — Per-Module Wireframes

For each module: old layout (current) → new layout (proposed) → block movement.

Each detail page gets the same spine:
1. **Sticky slim header** (R7) — appears on scroll past main header
2. **Quick actions row** below header (call, whatsapp, email, log, add task)
3. **Two-column body**: main column (timeline + content) + right rail
4. **Right rail top:** NextStepCard (R6, sticky)
5. **Right rail below:** context blocks (contact, KYC, related entities)
6. **Single interleaved Activity timeline** (no tabbed split)

---

## C1 — Lead Profile Page

### File: `apps/web/src/components/LeadProfilePage.tsx`

### OLD layout (current, source order)

```
1. Breadcrumbs (569-572)
2. Profile header card (574-681) — name, contact buttons, stage popover, Edit/Delete
3. Tab nav: Offers / Deals / Activity / KYC link (683-713)
4. KPI strip 3-col: Engagement / Last Contact / Budget (715-757)
5. MAIN COL (lg:col-span-2):
   5a. Activity timeline (763-838)
   5b. Offers tab (841-908)
   5c. Deals tab (911-941)
   5d. Interested units grid (943-994)
6. RIGHT SIDEBAR:
   6a. Lead info (1000-1027) — source, nationality, budget, agent, broker, notes
   6b. Comm preference (1030-1077)
   6c. Tasks block (1080-1143)
```

### Problems

- **No sticky CTA** (R6) — stage popover only appears on click, hidden by default.
- **No slim header** (R7) — name disappears on scroll.
- **Profile header is tall** (107 lines) — eats above-the-fold real estate before
  the user sees activity or next action.
- **KPI strip placement** — currently below the tabs; F-pattern says it should be
  in the header zone or right rail, not in the middle.
- **Tabs split content** that should be interleaved (Offers + Deals belong on the
  Activity timeline as discrete event cards, not separate tabs).
- **Sidebar tasks block has actions** (add task, complete) — actions belong in the
  next-step block per R6.

### NEW layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ SLIM HEADER (R7, slides in on scroll)                                     │
│ ← Back · Lead-#L1042 · John Doe · +971 5x… · [QUALIFIED]   [Move stage→] │
├───────────────────────────────────────────────────────────────────────────┤
│ MAIN HEADER (full)                                                        │
│ Breadcrumb                                                                │
│ John Doe                                            [QUALIFIED]   [more]  │
│ +971 5x… · john@…  [Call] [WA] [Email] [Log] [+ Task]                     │
├──────────────────────────────────────────────┬────────────────────────────┤
│ MAIN COL (lg:col-span 2)                     │ RIGHT RAIL (sticky top)    │
│                                              │                            │
│ Activity timeline (interleaved):             │ ┌─ NEXT STEP ────────────┐ │
│ - Call 3:42pm by Ahmed                       │ │ Move to PROPOSAL       │ │
│ - WhatsApp 2:10pm by lead                    │ │ Last touch 4d ago      │ │
│ - Offer V2 sent 1d ago [card]                │ │ [Move to PROPOSAL]     │ │
│ - Deal DL-204 created 3d ago [card]          │ │ Skip stage  Reassign   │ │
│ - Stage → QUALIFIED 5d ago                   │ └────────────────────────┘ │
│ - Site visit 7d ago by Ahmed                 │                            │
│ ...                                          │ ┌─ KPI ──────────────────┐ │
│ [+ Log activity]                             │ │ 12 touchpoints (30d)   │ │
│                                              │ │ Budget 1.5M            │ │
│ Filter chips: [All] [Calls] [Emails]         │ │ Last contact Mar 5     │ │
│ [Notes] [System]                             │ └────────────────────────┘ │
│                                              │                            │
│                                              │ ┌─ CONTACT ──────────────┐ │
│                                              │ │ Phone +971 5x…  [WA]   │ │
│                                              │ │ Email john@… [reply]   │ │
│                                              │ │ Source DIRECT          │ │
│                                              │ │ Nationality UAE        │ │
│                                              │ │ Agent Ahmed            │ │
│                                              │ │ Broker Apex Realty     │ │
│                                              │ └────────────────────────┘ │
│                                              │                            │
│                                              │ ┌─ INTERESTED UNITS ─────┐ │
│                                              │ │ ‣ T1-2403 (primary)    │ │
│                                              │ │ ‣ T1-2502              │ │
│                                              │ │ + Add interest         │ │
│                                              │ └────────────────────────┘ │
│                                              │                            │
│                                              │ ┌─ KYC SUMMARY ──────────┐ │
│                                              │ │ EID …7842   [view→]    │ │
│                                              │ │ Passport AAB123        │ │
│                                              │ └────────────────────────┘ │
│                                              │                            │
│                                              │ ┌─ COMM PREF ────────────┐ │
│                                              │ │ Channel WhatsApp       │ │
│                                              │ │ Email opt-out: no      │ │
│                                              │ └────────────────────────┘ │
└──────────────────────────────────────────────┴────────────────────────────┘
```

### Block movement

| Old | New | Status |
| --- | --- | --- |
| Profile header (574-681) | Stays as main header but trimmed. Stage popover removed. | Compress |
| Quick action buttons (588-621) | Promoted to header, larger, click-to-act per D3 | Promote |
| Stage badge + popover (625-662) | **Deleted**; replaced by NextStepCard in right rail | Replace |
| Tab nav (683-713) | **Deleted**. Offers/Deals collapse into timeline as event cards. | Delete |
| KPI strip (715-757) | Moved to right rail | Move |
| Activity timeline (763-838) | Becomes the main column. Type filter chips above (D1 will replace tabs.) | Promote |
| Offers tab (841-908) | Each offer becomes a timeline card (sent, accepted, rejected events) + a sidebar block "Open offers (2)" | Distribute |
| Deals tab (911-941) | Becomes a sidebar block "Active deals" and timeline cards on creation/stage-change | Distribute |
| Interested units (943-994) | Right rail block (compressed list, link to manage) | Move |
| Lead info sidebar (1000-1027) | Stays in right rail (Contact + meta) | Stay |
| Comm preference (1030-1077) | Stays in right rail, compressed | Compress |
| Tasks block (1080-1143) | **Replaced** by NextStepCard + the action queue on My Day. Detail page surfaces only one upcoming task (the next due). | Replace |

### Reading order (F-pattern)

1. Slim header on scroll (always visible)
2. Lead name + stage badge (top-left)
3. Quick actions (top, scan right)
4. NextStepCard (top-right — the one block that always demands action)
5. Activity timeline (large left column, vertical scroll)
6. Right rail context (post-action context)

### Mobile (<768px)

Right rail collapses below main. NextStepCard becomes a `fixed bottom-0` action bar.
Quick actions reduce to icon-only (Call / WA / Email / Log).

### What's deleted

- Stage popover (R6 makes it stickier and clearer)
- Tab nav for Offers/Deals (replaced by timeline cards + sidebar links)
- Tasks "add" form on detail (lives on My Day; one inline "next task" still
  surfaced inside NextStepCard)

---

## C2 — Deal Detail Page

### File: `apps/web/src/components/DealDetailPage.tsx`

### OLD layout (current, source order — confirmed via R5/R6/R7 sweep)

```
1. Header — deal #, buyer, unit, price, stage badge (~700-820)
2. Header CTA bank — stage-dependent buttons (763-820): Reserve / Generate Sales
   Offer / Generate SPA / Mark Signed / Record Payment / Mark Handed Over
3. Body tabs: Timeline / Payments / Activity / Tasks / History
4. Bottom-sticky bar (2172-2185) — "Next step: STAGE" + CTA button
5. ConfirmDialog stage move (2227-2235)
```

### Problems

- **Bottom-sticky CTA** wrong direction (R6 wants top-right).
- **Stage CTA bank** at top is good in spirit but unsticky → scrolls away on long
  payment lists.
- **Activity tab separate from Timeline tab** — both reuse the same data; one is
  Activity timeline + filters, the other is "Timeline" of stage history. Confusing
  duplicate.
- **Per-stage CTA spam** — 6 stage-conditional buttons crowd the header (`771,780,789,797,808`).

### NEW layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ SLIM HEADER on scroll: ← Deal-DL204 · John Doe · T1-2403 ·                │
│                        [SPA_PENDING]               [Generate SPA →]       │
├───────────────────────────────────────────────────────────────────────────┤
│ MAIN HEADER                                                               │
│ Deal-DL204 · T1-2403 · John Doe                          [SPA_PENDING]   │
│ <Dirham> 1,250,000 · 4d in stage                                          │
│ [Open lead] [Open unit] [Log] [+ Task]                                    │
├──────────────────────────────────────────────┬────────────────────────────┤
│ MAIN COL (col-span 2)                        │ RIGHT RAIL (sticky)        │
│                                              │                            │
│ Stepper (compact): Reserve→Sales→SPA→        │ ┌─ NEXT STEP ───────────┐  │
│ Oqood→Payment→Handover                       │ │ Generate SPA Draft   │  │
│ ✓ Reserved · ✓ Sales offer · ◉ SPA pending  │ │ Aging 4d (max 7d)    │  │
│                                              │ │ [Generate SPA]        │  │
│ Filter: [All] [Calls] [Payments] [System]    │ │ Skip stage  Reassign  │  │
│                                              │ └───────────────────────┘  │
│ Activity timeline (interleaved):             │                            │
│ - Sales offer V2 generated 2d ago [card]     │ ┌─ FINANCIAL ──────────┐  │
│ - Reservation paid 5d ago [card]             │ │ Sale     1.25M       │  │
│ - Stage → SPA_PENDING 5d ago                 │ │ Paid       50k       │  │
│ - Reservation created 7d ago                 │ │ Remain  1.20M        │  │
│                                              │ │ Next due Mar 28      │  │
│ [+ Log activity]                             │ └───────────────────────┘  │
│                                              │                            │
│ Payments table (collapsible)                 │ ┌─ COMMISSION ─────────┐  │
│ #  Due       Amount    Status                │ │ Apex Realty 4%       │  │
│ 1  Mar 28    250k     PENDING                │ │ Unlocked: SPA + Oqood│  │
│ 2  Apr 28    250k     PENDING                │ │ Status: Pending      │  │
│ 3  May 28    250k     PENDING                │ └───────────────────────┘  │
│ ...                                          │                            │
│                                              │ ┌─ DOCUMENTS ──────────┐  │
│                                              │ │ Sales Offer V2 (PDF) │  │
│                                              │ │ Reservation form     │  │
│                                              │ │ + Upload             │  │
│                                              │ └───────────────────────┘  │
│                                              │                            │
│                                              │ ┌─ PARTIES ────────────┐  │
│                                              │ │ Lead   John Doe →    │  │
│                                              │ │ Unit   T1-2403  →    │  │
│                                              │ │ Agent  Ahmed         │  │
│                                              │ │ Broker Apex Realty → │  │
│                                              │ └───────────────────────┘  │
└──────────────────────────────────────────────┴────────────────────────────┘
```

### Block movement

| Old | New | Status |
| --- | --- | --- |
| Header CTA bank (763-820, 6 buttons) | Collapse to NextStepCard (one primary action), the rest into the stepper | Replace |
| Bottom-sticky bar (2172-2185) | **Deleted**; NextStepCard takes over | Delete |
| Timeline tab | Becomes the stepper at top of main col | Promote |
| Activity tab | Becomes main column timeline (interleaved) | Promote |
| Payments tab | Becomes collapsible section in main col, below timeline | Move |
| Tasks tab | Folded into NextStepCard (next 1) + My Day for the rest | Distribute |
| History tab | Stage-change events appear in timeline; full history stays under "View all stage changes" link in stepper | Distribute |
| ConfirmDialog (2227-2235) | Replaced by optimistic + undo per R5 | Replace |

### What's deleted

- The 6-button per-stage CTA cluster (only one primary at a time)
- The bottom-sticky strip (R6 says top)
- The duplicate Activity vs Timeline split

---

## C3 — Unit Detail Page

### File: `apps/web/src/components/UnitDetailPage.tsx`

### OLD layout

```
1. UnitHeader (140-145) — sticky-ish
2. Error banner (147-155)
3. Snag list link (158-168, flag-gated)
4. MAIN GRID (170-595):
   LEFT col (col-span 2):
     - ActiveDealSummaryCard (176)
     - Floor plan hero (179-229)
     - Photo carousel (222-228)
     - "Share with lead" CTA (232-240)
     - Key info bar (243-268)
     - Property specs (271-305)
     - Current price (308-360, inline-editable)
     - Payment plan card (363)
     - Physical details (366-396)
     - Tags & notes (399-450)
     - History (453)
     - Activity logger (456)
     - Danger zone (459-482)
   RIGHT col:
     - Share link panel (489-491)
     - Documents (494-517)
     - Status actions (520)
     - Commercial panel (523, interested leads/deals)
     - Assigned agent (526-547)
     - Block reason (550-565, conditional)
     - Activity stats (568-580)
     - Similar units (583-587)
     - Last updated (590-593)
```

### Problems

- **No NextStepCard** (R6) — status change buried in `UnitStatusActions` deep in the
  right rail.
- **Header doesn't slim on scroll** (R7) — the floor plan hero is tall, and unit
  number disappears.
- **Danger zone is sandwiched between content blocks** (459-482) — shouldn't be
  inline; should live under a `Settings` panel or at very bottom.
- **Information density very high** but **action density very low**. Many context
  blocks compete for the right rail.
- **"Share with lead" isn't the primary action** for an AVAILABLE unit — the
  primary is "Block / Reserve / Open active deal".

### NEW layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ SLIM HEADER on scroll: ← Unit-T1-2403 · Project Alpha · [AVAILABLE]       │
│                                                          [Block unit →]   │
├───────────────────────────────────────────────────────────────────────────┤
│ MAIN HEADER                                                               │
│ T1-2403 · 2BR · Floor 24 · 1,180 sqft           [AVAILABLE]               │
│ Project Alpha → · [Share] [Open active deal]                              │
├──────────────────────────────────────────────┬────────────────────────────┤
│ MAIN COL                                     │ RIGHT RAIL (sticky)        │
│                                              │                            │
│ Floor plan hero (compact, 2/3 viewport)      │ ┌─ NEXT STEP ───────────┐  │
│ Photo strip below                            │ │ Block this unit       │  │
│                                              │ │ Available 47 days     │  │
│ Key info bar (5-col)                         │ │ [Block]   [Hold]      │  │
│ Type · Floor · View · Area · <Dirham>/sqft   │ └───────────────────────┘  │
│                                              │                            │
│ Pricing card                                 │ ┌─ ACTIVE DEAL ─────────┐  │
│ <Dirham> 1,250,000 · 1,059/sqft  [Edit]      │ │ DL-204 · John Doe →   │  │
│ Base: 1,200,000 (line-through)               │ │ SPA_PENDING · 4d      │  │
│                                              │ └───────────────────────┘  │
│ Property specs (2-col grid)                  │                            │
│ Purpose · Furnishing · Completion · ...      │ ┌─ INTEREST ────────────┐  │
│                                              │ │ 3 leads interested    │  │
│ Payment plan (collapsible)                   │ │ John D · Aisha K · …  │  │
│                                              │ │ 2 site visits         │  │
│ Activity logger (interleaved feed)           │ │ 8 inquiries (30d)     │  │
│ - 2024-Mar-05 Site visit by John Doe         │ └───────────────────────┘  │
│ - 2024-Mar-01 Price adj 1.20M → 1.25M        │                            │
│ - 2024-Feb-22 Listed                         │ ┌─ DOCUMENTS ───────────┐  │
│                                              │ │ Floor plan (PDF)      │  │
│ Tags · Notes                                 │ │ Brochure              │  │
│                                              │ │ + Upload              │  │
│                                              │ └───────────────────────┘  │
│                                              │                            │
│                                              │ ┌─ AGENT ───────────────┐  │
│                                              │ │ Ahmed (reassign…)     │  │
│                                              │ └───────────────────────┘  │
│                                              │                            │
│                                              │ ┌─ SHARE LINK ──────────┐  │
│                                              │ │ samha.app/u/t1-2403   │  │
│                                              │ │ [Copy] [Revoke]       │  │
│                                              │ └───────────────────────┘  │
│                                              │                            │
│                                              │ ┌─ SIMILAR UNITS ───────┐  │
│                                              │ │ T1-2503 · 2BR · 1.30M │  │
│                                              │ │ T2-1804 · 2BR · 1.22M │  │
│                                              │ └───────────────────────┘  │
│                                              │                            │
│                                              │ Settings (collapsed)       │
│                                              │ • Delete unit              │
└──────────────────────────────────────────────┴────────────────────────────┘
```

### Block movement

| Old | New | Status |
| --- | --- | --- |
| UnitHeader (140-145) | Becomes main header + spawns slim header | Stay |
| Floor plan hero (179-229) | Compress vertically (was full-height); becomes 2/3 viewport max | Compress |
| ActiveDealSummaryCard (176) | Move to right rail "ACTIVE DEAL" block | Move |
| Share with lead button (232-240) | Demoted from main CTA to header inline button (not primary) | Demote |
| Status actions (520, in right rail) | **Deleted as a card**; status change comes through NextStepCard | Replace |
| Danger zone (459-482, inline middle) | Moved to bottom of right rail under collapsed "Settings" | Move |
| Activity stats (568-580) | Folded into "INTEREST" right-rail block | Merge |
| Block reason (550-565, conditional) | Becomes inline metadata in the BLOCKED-state NextStepCard | Merge |
| Last updated (590-593) | Moves to footer of right rail (one line) | Compress |
| Commercial panel (523, leads/deals interested) | Becomes "INTEREST" right-rail block | Rename |

### What's deleted

- Inline danger zone in the middle of the page
- Standalone "Status actions" card (NextStepCard absorbs it)

---

## C4 — Project Detail Page

### File: `apps/web/src/components/ProjectDetailPage.tsx`

### OLD layout

```
1. Sticky header (160-274):
   - Breadcrumb (163-168)
   - Title + status badge + meta (169-190)
   - KPI strip 4-col (194-204)
   - Tab nav (207-273): Overview · Units · Leads · Deals · Brokers · Updates · History
2. Tab content (277-481):
   - Overview: handover countdown + pipeline snapshot
   - Units: <UnitsTable>
   - Leads: table
   - Deals: table
   - Brokers: card grid
   - Updates: <ProjectUpdatesTab>
   - History: <ProjectStatusHistoryPanel>
3. Sub-page links (Phases, Type plans, Construction, Escrow — flag-gated)
```

### Problems

- **Sticky header never slims** — full KPI strip + tab nav stays at full height,
  eating ~200px of viewport on every scroll. R7 wants slim mode.
- **No next-step CTA** — only Edit (`185`).
- **7 main tabs + 4 sub-page links** = 11 navigation targets per project. Very heavy.
  [Likely first-audit overlap on sub-page sprawl.]
- **Brokers tab on a Project** is unusual — most CRMs put broker management at the
  org level, not per-project. The data shown (commission rate per broker on this
  project) could live as a section inside Overview.

### NEW layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ SLIM HEADER on scroll: ← Project Alpha · [LAUNCHED]            [Add unit] │
├───────────────────────────────────────────────────────────────────────────┤
│ FULL HEADER (collapses past 200px scroll)                                 │
│ Project Alpha                                          [LAUNCHED] [Edit]  │
│ Downtown · 60% complete · Handover Q3 2026                                │
│ ───────────────────────────────────────────────────────                   │
│ 240 units · Handover 287d · 18 leads · 12 deals                          │
│ ───────────────────────────────────────────────────────                   │
│ [Overview] [Units] [Leads] [Deals] [Updates] [History]                   │
├──────────────────────────────────────────────┬────────────────────────────┤
│ MAIN COL (varies by tab)                     │ RIGHT RAIL (sticky)        │
│                                              │                            │
│ OVERVIEW tab (default):                      │ ┌─ NEXT STEP ───────────┐  │
│ - Handover countdown widget                  │ │ Add unit              │  │
│ - Pipeline snapshot (leads + deals)          │ │ 12 unsold of 240      │  │
│ - Brokers section (was a tab; now inline)    │ │ [Add unit]            │  │
│ - Recent updates feed (last 5)               │ │ [Bulk import]         │  │
│                                              │ └───────────────────────┘  │
│ UNITS tab: <UnitsTable> with saved-view      │                            │
│ pills (D6)                                   │ ┌─ INVENTORY ───────────┐  │
│                                              │ │ Available 12          │  │
│ LEADS tab: leads table for this project      │ │ Reserved   8          │  │
│                                              │ │ Sold      220         │  │
│ DEALS tab: deals table for this project      │ │ Blocked    0          │  │
│                                              │ └───────────────────────┘  │
│ UPDATES tab: <ProjectUpdatesTab>             │                            │
│                                              │ ┌─ ESCROW & TYPE ───────┐  │
│ HISTORY tab: status-history panel            │ │ Escrow account →      │  │
│                                              │ │ Type plans (4) →      │  │
│                                              │ │ Phases (2) →          │  │
│                                              │ │ Construction →        │  │
│                                              │ └───────────────────────┘  │
│                                              │                            │
│                                              │ ┌─ KEY DATES ───────────┐  │
│                                              │ │ Launch 2024-Jan-15    │  │
│                                              │ │ Start  2024-Mar-01    │  │
│                                              │ │ Handover Q3 2026      │  │
│                                              │ └───────────────────────┘  │
└──────────────────────────────────────────────┴────────────────────────────┘
```

### Block movement

| Old | New | Status |
| --- | --- | --- |
| Sticky header (160-274) | Same position, but **collapses to slim mode** past 200px scroll. KPI strip and tabs hide; tabs re-pin below slim bar. | Refactor |
| Tab "Brokers" (444-469) | Moved into Overview as an inline section | Inline |
| Tab nav: 7 → 6 tabs | One fewer | Compress |
| Sub-page links (Phases / Type plans / Construction / Escrow) | Move from inline links into right-rail "ESCROW & TYPE" block | Move |
| Edit button (185) | Stays top-right but demoted to icon-only on slim header | Compress |
| (None) NextStepCard | **New**, lifecycle-driven action | Add |
| (None) Inventory block | **New**, scoped right-rail counts | Add |

### Reading order

1. Slim header (always visible on scroll)
2. Project name + status (top-left)
3. KPI strip (scan right)
4. NextStepCard (top-right)
5. Tab content (main vertical)
6. Right rail context (post-action)

### What's deleted

- Brokers tab as a top-level tab
- Free-floating sub-page links in the header (consolidated to right-rail block)

---

# PART D — Workflow Fixes

Each fix below: **what** + **where** + **behavior**.

## D1 — Next Steps widget

**What.** A single widget per Lead/Deal/Unit that wraps Task rows due ≤ 14 days,
sorted by due date, with inline complete/snooze/reassign and natural-date input.

**Where.**
- New: `apps/web/src/components/ui/NextStepCard.tsx`
- New: `apps/web/src/components/ui/QuickTaskInput.tsx` — wraps `chrono-node` for
  "tomorrow 3pm" parsing (small dep, ~30KB)
- Mounted in: `LeadProfilePage.tsx` (replace tasks block 1080-1143),
  `DealDetailPage.tsx` (replace tasks tab + bottom-sticky), `UnitDetailPage.tsx`
  (new)

**Behavior.**
- Shows next 3 tasks due ≤ 14d. "View all" link goes to `/tasks?leadId=…` filter.
- Each row: type icon, title, due chip ("today", "in 2d", "3d overdue").
- Inline buttons: `Complete`, `Snooze 1d / 3d / 1w`, `Reassign`.
- Add input at bottom: `"call back tomorrow 3pm"` → parsed → server creates
  `Task` with parsed `dueDate`. If parse fails, show inline error and let user
  pick from a date popover.
- This is the **only** task-input surface on detail pages. Activities = past,
  Reminders (system-generated) = invisible/automatic. Don't show all three.

## D2 — Quick-Log floating button

**What.** Floating `+ Log` button bottom-right on every Lead/Deal detail. Opens
inline 60×60-class form: type pill, summary line, optional outcome, Cmd+Enter to
save, closes with toast.

**Where.**
- New: `apps/web/src/components/QuickLogPopover.tsx`
- Mounted in: `LeadProfilePage.tsx`, `DealDetailPage.tsx`, kanban card hover
  layer (`LeadsKanban.tsx`, `DealsKanban.tsx`)

**Behavior.**
- Type defaults to `CALL` (most common).
- Submit creates an `Activity` row with `createdBy = current user`,
  `activityDate = now`, `summary` and optional `outcome`.
- Toast: `"Call logged on John Doe"` with Undo (deletes the activity).
- Cmd+Enter submits, Esc cancels.
- Goal: log a call in <5 seconds.
- On kanban: hover reveals a small `+` button per card; click opens the same popover
  pre-filled with that lead.

## D3 — Click-to-act on contact data

**What.** Phone, email, address, WhatsApp number become click targets, not text.

**Where.**
- New helper: `apps/web/src/components/ui/ContactLink.tsx` accepting
  `{ kind: "phone"|"email"|"whatsapp"|"address", value }`.
- Apply on: lead profile sidebar (`LeadProfilePage.tsx:1015-1020`), contact detail
  (`ContactDetailPage.tsx`), broker agent rows (`BrokerPage.tsx`), deal sidebar
  parties block (new).

**Behavior.**
- `phone` → renders `<a href="tel:+9715…">` with a small `MessageCircle`
  WhatsApp icon next to it; the icon opens `https://wa.me/9715…`.
- `email` → opens the in-app `ConversationReplyBox` pre-filled (route or modal).
- `address` → opens `https://www.google.com/maps?q=encoded` in new tab.
- `whatsapp` → same as phone WhatsApp icon.

## D4 — Staleness & temperature signals

**What.** Visual decay on stale records.

**Where.**
- New helper: `apps/web/src/lib/temperature.ts` returning a token name from age.
- Apply on: `LeadsKanban.tsx` card (border-left), `DealsKanban.tsx` card (aging
  chip when stuck), `UnitMatrixGrid.tsx` cell (greyed BLOCKED past expiry-1d).

**Behavior.**
- **Lead card**: left border 4px, color from `lastContactedAt`:
  - 0–3d → `border-primary/60`
  - 4–7d → `border-muted-foreground/30`
  - 8–14d → `border-warning`
  - 15+d → `border-destructive/60`
  - Caption: "12d ago" inline, relative format.
- **Deal card**: aging chip `"4d in stage"` red text when `> stageMaxDays`.
  Defaults: `RESERVATION_PENDING` 3d, `SPA_PENDING` 7d, `OQOOD_PENDING` 14d.
  Configurable in settings.
- **Unit grid**: BLOCKED cells get `opacity-40` once their `holdExpiresAt < now-1d`
  (signaling auto-release imminent).

**Settings.** Add `apps/web/src/pages/SettingsPage.tsx` block "Stage SLAs" with one
input per stage. Backend stores per-org config in a new `OrgSettings` row (or
existing settings table — confirm during implementation).

## D5 — Keyboard navigation

**What.** Global and detail-page shortcuts.

**Where.**
- New hook: `apps/web/src/hooks/useGlobalShortcuts.ts`
- New: `apps/web/src/pages/KeyboardShortcutsPage.tsx`
- New: `apps/web/src/components/ShortcutsModal.tsx` (`?` opens it from anywhere)
- Mounted in: `AppShell.tsx`

**Behavior.**
- Global: `/` focus search · `?` show modal · `g+l` leads · `g+d` deals · `g+u`
  units · `g+p` projects · `g+h` home (My Day).
- Detail pages: `e` edit · `n` new note · `c` log call (opens QuickLog with type=CALL)
  · `t` add task · `Esc` close.
- Kanban: `j`/`k` move focus card · `Enter` open · `←`/`→` move stage (with
  optimistic + undo per R5).

**Edge.** Disable shortcuts when focus is in an `<input>` / `<textarea>` /
`contentEditable`.

## D6 — Saved views + URL filters

**What.** Filters persist to URL; users save named views.

**Where.**
- New: `apps/web/src/hooks/useUrlFilters.ts` — read/write
  `useSearchParams()` for `/leads`, `/deals`, `/units`, `/payments`.
- Schema: add `UserView` model: `{ id, userId, scope: "leads|deals|units|payments",
  name, filters: Json, createdAt }`.
- New endpoint: `GET/POST/DELETE /api/users/:id/views`.
- UI: new `<SavedViewBar />` component above tables/kanbans. Default views
  hard-coded into client: `My open leads` (assignedAgentId=me, stage in NEW..NEGOTIATING),
  `Stalled deals` (stage age > stageMaxDays), `Payments due this week`
  (status=PENDING, dueDate ≤ now+7d).

**Behavior.**
- All filter changes mutate URL → bookmarkable.
- "Save view" button captures current filters into `UserView`. Saved views render as
  pills above the list.

## D7 — Bulk operations

**What.** Multi-select on `/leads` and `/deals`. Action bar appears on selection.

**Where.**
- Add row checkbox to `LeadsPage.tsx` table view, `DealsPage.tsx` table view.
- New: `apps/web/src/components/BulkActionBar.tsx`.
- New endpoints: `PATCH /api/leads/bulk-reassign`, `PATCH /api/leads/bulk-stage`,
  `POST /api/leads/bulk-message`, `GET /api/leads/export?ids=…`.

**Behavior.**
- Select ≥1 → fixed action bar at bottom: `Reassign · Move stage · Send message ·
  Export · Cancel`.
- Confirms once for the whole batch (this is destructive bulk → ConfirmDialog
  per R5 — bulk operations are real-impact).

## D8 — Notification bell

**What.** Bell already in AppShell (lines 320-323). Audit-flagged: it's emoji-driven
(R1 fix), uses `dev-user-1` hard-coded ID, polls every 5min instead of SSE.

**Where.**
- Existing: `AppShell.tsx:44-330`.
- Backend: existing endpoints `GET /api/users/:userId/notifications` and
  `PATCH .../:notificationId`.
- New: SSE channel `notif:<userId>` published on Notification create.

**Behavior.**
- Replace `dev-user-1` with current authenticated user.
- Replace 5min polling with SSE subscription.
- Replace emoji icon map (NOTIF_ICONS at 44-52) with lucide map (R1.A above).
- Mark-all-read button.
- Click row → navigate to `entityType` + `entityId` route.

## D9 — Presence indicators

**What.** Avatar stack top-right of detail page showing other users currently
viewing the same entity.

**Where.**
- New SSE channels: `presence:lead:<id>`, `presence:deal:<id>`, etc.
- New hook: `apps/web/src/hooks/usePresence.ts`.
- Mounted on: each detail page header.

**Behavior.**
- On mount, page broadcasts `presence.join` with userId + entityType + entityId.
- Server tracks per-entity viewer set; sends `presence.update` to the channel.
- Page renders avatar stack (max 3) with tooltip `"Ahmed is viewing"`.
- On unmount or 30s of no heartbeat, remove from set.

## D10 — Skeleton loaders

**What.** Replace generic spinners with shape-matched skeletons.

**Where.**
- New components: `apps/web/src/components/ui/skeletons/{KanbanCardSkeleton,
  TableRowSkeleton, DetailHeaderSkeleton, ActivityFeedSkeleton}.tsx`.
- Replace generic spinners at:
  - `LeadProfilePage.tsx:559-561` (generic spinner)
  - `DealDetailPage.tsx` (multiple early-return spinners)
  - `UnitDetailPage.tsx:54-60`
  - `ProjectDetailPage.tsx:125-130`
  - All Kanban / Table loading states.

**Behavior.**
- Skeleton shape mirrors final layout (header bar, KPI strip pills, sidebar blocks).
- Uses `animate-pulse` on `bg-muted` rectangles. Token-based, no hex.

---

# PART E — Convention Fixes

CRM-baseline features currently missing or partial. Effort: **S** (≤1 day),
**M** (2–4 days), **L** (≥1 week). Priority: **P0** (block daily work), **P1**
(meaningful daily), **P2** (nice-to-have weekly), **P3** (occasional).

| # | Convention | Where (file/area) | Effort | Priority | Note |
| - | --- | --- | :-: | :-: | --- |
| E1 | Lead-source attribution chip on every lead card | `LeadsKanban.tsx` card body, `LeadsPage.tsx` row | S | P1 | Source field exists; chip is missing |
| E2 | "Last activity" column in lead/deal tables, sortable | `LeadsPage.tsx` table view, `DealsPage.tsx` | S | P0 | Powers triage; backend exposes `lastContactedAt` already |
| E3 | Stage-duration badge on kanban cards ("4d in this stage") | `LeadsKanban.tsx`, `DealsKanban.tsx` | S | P0 | Reuses D4 staleness |
| E4 | Won/Lost reason required when closing | New `<CloseReasonModal>`; intercepts CLOSED_WON / CLOSED_LOST in `leadService.updateStage` | M | P0 | Reporting needs reason taxonomy |
| E5 | @mention in notes (notify mentioned user) | `apps/web/src/components/ui/MentionTextarea.tsx` + backend mention parsing in `activityService` | M | P2 | Adds collaborative dimension |
| E6 | Email/WhatsApp templates with per-stage suggestions | `Settings → Templates` page + selector in `ConversationReplyBox` | L | P1 | Per-stage template catalog table |
| E7 | Activity-type filters on timeline (calls only, emails only, system only) | Filter chips in `ConversationThread.tsx` (Lead) and Deal main col timeline | S | P1 | Pure client-side filter; data already typed |
| E8 | "Last 30 days" default time filter on reports | `ReportsPage.tsx`, `ExecutiveDashboard.tsx` | S | P2 | Currently uses lifetime |
| E9 | Lead-card collapse on mobile (gesture) | `LeadsKanban.tsx` mobile breakpoint | M | P3 | Useful when mobile load lots of cards |
| E10 | Org-wide audit log accessible from Settings | New `/settings/audit-log` page; backend endpoint exists | S | P3 | Compliance ask |

---

# PART F — Sweep summary (file-by-file)

This is the operative checklist for the implementation PRs. Each row maps one file
to a fix bundle.

## F1 — Top files by total fix count (>10 fixes)

| File | R1 | R3 | R4 | R5 | R6 | R7 | Total |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `components/DealDetailPage.tsx` | 26 | 10 | 1 | 2 | 1 | 1 | **41** |
| `components/LeadProfilePage.tsx` | 9 | 10 | 1 | 1 | 1 | 1 | **23** |
| `components/UnitDetailPage.tsx` | 6 | 4 | – | – | 1 | 1 | **12** |
| `components/UnitModal.tsx` | – | 6 | – | – | – | – | **6** |
| `components/CreateOfferModal.tsx` | – | 6 | – | – | – | – | **6** |
| `pages/DealCreatePage.tsx` | 4 | 6 | – | – | – | – | **10** |
| `components/ExecutiveDashboard.tsx` | 2 | 8 | – | – | – | – | **10** |
| `components/UnitsTable.tsx` | 3 | 5 | – | – | – | – | **8** |
| `components/ConversationThread.tsx` | 11 | – | 1 | – | – | – | **12** |
| `components/AppShell.tsx` | 9 | – | – | – | – | – | **9** |

These 10 files contain the bulk of the work and should anchor PR boundaries.

## F2 — R1 emoji full list

The full 188-row file:line table is captured by the R1 sweep agent. To avoid bloating
this document, the canonical reference lives in the agent transcript; the **PR
implementation** uses the centralized icon-map fix (R1.A) plus per-file inline-literal
fixes (R1.B). Maps fix ~120 of 188 occurrences in one stroke. The remaining 68 inline
literals are listed by file below in F4.

## F3 — R3 AED full list

199 occurrences. Categorical breakdown:

- **DISPLAY** (110) → swap inline `` `AED ${n.toLocaleString()}` `` for `formatDirham(n)`
- **INPUT** (36) → remove "(AED)" from labels, add `<DirhamSign>` adornment in input padding
- **PRINT** (~11 per print page × 6 pages) → **KEEP**, no change
- **SELECT-OPTION** (3 in `UnitsTable.tsx:558-559`, `pages/UnitsBulkPage.tsx:416`) → **KEEP**, distinguishes from "%"

Per-file references already enumerated in Part A R3 sections (R3.2 / R3.3 / R3.4).

## F4 — Per-file PR bundles (proposed)

### PR-1 (S): Foundation primitives
Adds:
- `components/ui/DirhamSign.tsx`
- `lib/money.tsx` with `formatDirham`, `formatDirhamCompact`
- `lib/optimisticToast.ts` (R5 helper)
- `lib/temperature.ts` (D4 helper)
- `lib/relativeDate.ts` consolidates 4 copies (R4 fix)
- `components/ui/NextStepCard.tsx`
- `components/ui/SlimHeader.tsx`
- `components/ui/ContactLink.tsx`
- `components/ui/skeletons/*`
- `components/ui/README.md`
- `assets/dirham.svg`

No behavior changes; just the building blocks. Type-only.

### PR-2 (M): R1 centralized icon-map sweep
Replaces emoji string maps with lucide component maps in the 13 files listed in R1.A.
Each map fix transparently fixes its consumers. Visual change is significant.

### PR-3 (S): R1 inline-literal sweep
The 68 inline emojis in JSX listed in R1.B. Mechanical replacement with lucide.

### PR-4 (M): R3 currency sweep — DISPLAY contexts
Replaces all 110 inline AED literals with `formatDirham()`. Splits into 3 sub-PRs by
module (Lead-related, Deal-related, Unit/Project/Reports).

### PR-5 (S): R3 currency sweep — INPUT adornments
36 input-label changes plus the input adornment pattern.

### PR-6 (S): R4 date consolidation
Adds `formatRelative` to `lib/relativeDate.ts`, removes 4 ad-hoc copies, swaps
detail-page relative dates to absolute (LeadProfilePage:744, DealDetailPage:1309,
plus the conversation/activity-feed carve-out for ≤60min).

### PR-7 (M): R5 confirmations + R6/R7 primitives wired
Switches the 7 misclassified ConfirmDialog usages to `optimisticAction()`. Replaces
the 5 `window.confirm` calls with `ConfirmDialog`. Mounts `<NextStepCard>` and
`<SlimHeader>` on Lead, Deal, Unit, Project detail pages. Removes the
DealDetailPage bottom-sticky strip.

### PR-8 (M): My Day home (Part B)
- New backend endpoints: `GET /api/my-day/summary`, `GET /api/my-day/queue`, plus
  agent-scoped filter on existing endpoints.
- New frontend: `MyDayPage`, `<MyDayStrip>`, `<ActionQueue>`, `<PipelinePulse>`,
  `<HotInboxPreview>`.
- Routing change in `router.tsx` (`<RoleAwareHome>` wrapper).

### PR-9 (M): Workflow fixes D1 + D2 + D3
NextStepCard wiring (D1), QuickLog popover (D2), ContactLink everywhere (D3).

### PR-10 (M): D4 staleness signals + D6 saved views + E2 last-activity column

### PR-11 (S): D5 keyboard shortcuts + ShortcutsModal

### PR-12 (S): D8 notification bell upgrade (SSE + lucide + auth user)

### PR-13 (M): D7 bulk operations + D9 presence

### PR-14 (S): D10 skeleton loaders + E1/E3/E7/E8 misc convention fixes

### PR-15 (M): E4 won/lost reason + E6 templates + E5 mentions

---

# PART G — Top 15 ranked by user-impact-per-effort

Combining first-audit themes (where inferable) with this audit's findings.

| Rank | Fix | Effort | Why it matters daily |
| :-: | --- | :-: | --- |
| 1 | **My Day home (Part B)** | M | Members open `/` 20× per day. The org dashboard is irrelevant to them. Personal queue is the single biggest workflow win. |
| 2 | **NextStepCard top-right + SlimHeader (R6 + R7)** on all 4 detail pages | M | Every detail-page session ends in "what next?" — answer must be visible all the time. Removes 80% of the "where did the action button go" friction. |
| 3 | **Quick-Log popover (D2)** | M | An agent logs 50+ touches a day. Today each takes ~4 clicks + a navigation. <5s logging compounds across the team. |
| 4 | **R1 emoji sweep (centralized maps + inline)** | M | 188 visual violations damage credibility instantly. Fix-per-cost is unbeatable since maps cascade to ~120 of them. |
| 5 | **R3 DirhamSign sweep (DISPLAY only first)** | M | Currency typography is the most-seen element on the app. Switching to the official symbol is a brand statement. |
| 6 | **Optimistic + Undo (R5) for stage moves & log actions** | S | "Are you sure?" 7× a day per agent is psychic friction. 5s undo toast is the modern default. |
| 7 | **Last-activity column + staleness border (E2 + D4)** | S | Triage by stale lead is the #1 daily pattern. One column + one border color makes the whole list scannable. |
| 8 | **Click-to-act phone/email/address (D3)** | S | Every lead profile sidebar today is a wall of plain text. Tap-to-dial / wa.me / maps is table stakes. |
| 9 | **Saved views + URL filters (D6)** | M | "My open leads" / "Stalled deals" become one click instead of every-day reapplication of filters. |
| 10 | **R4 date consolidation + relative-in-list, absolute-in-detail** | S | Prevents confusion ("12d ago" in a contract printout) without changing data. |
| 11 | **Notification bell upgrade (D8 — SSE + lucide + auth user)** | S | Already 80% built. SSE wakes the bell instantly; using auth user fixes "dev-user-1" hard-code. |
| 12 | **Won/Lost reason at close (E4)** | M | Reporting layer is starved without it. Required for any conversion analytics. |
| 13 | **Keyboard shortcuts (D5)** | S | Power users adopt; novices ignore. Small effort, high stickiness for the top 20%. |
| 14 | **Bulk operations on /leads /deals (D7)** | M | Solves Friday-afternoon admin (reassign 30 leads to leaving agent's replacement). Currently impossible without DB access. |
| 15 | **Skeleton loaders (D10)** | S | Perceived-perf upgrade across every list. Easy to ship after PR-1's primitives land. |

**Likely first-audit overlaps** (mark in Part G if first audit's IDs surface): #2 (placement), #4 (visual quality), #5 (currency), #14 (bulk ops sprawl), and the
"sub-page sprawl" pattern noted in C4.

---

## Constraints check

- **Read actual files** — every claim cites `path:line`. Where data was contradictory
  between the layout-research agent and the R5/R6/R7 agent (DealDetailPage tabs),
  I sided with the R5/R6/R7 agent since it provided concrete line numbers
  (763-820 for header CTAs, 2172-2185 for bottom-sticky bar, 2227-2235 for
  ConfirmDialog). Re-verify during PR-7 implementation.
- **No new pages** except My Day. ✓
- **Design tokens only.** Tokens used in this doc: `primary`, `accent-2`,
  `success`, `warning`, `destructive`, `info`, `muted-foreground`. No hex. ✓
- **Mobile noted** for every layout. ✓
- **First audit IDs** — flagged where unavailable. If you can paste them, I'll
  retrofit Part G with explicit cross-references.

---

## What's NOT in this audit

- Backend code review beyond endpoints needed for My Day and bulk ops.
- Test coverage of the fixes (call out in implementation PRs).
- Accessibility deep-dive beyond R3.g (ARIA on DirhamSign).
- Performance audit (separate concern).
- Mobile-first redesign (this audit treats mobile as secondary, per brief).

---

## Next step from here

Sign-off on this document → I implement in the PR sequence in F4 (PR-1 first
since everything else depends on it). Each PR ships independently with its own
review.
