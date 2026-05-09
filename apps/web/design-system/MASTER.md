# Samha CRM — Design System (MASTER)

Single source of truth for the app's visual language. Every component must follow these rules unless a `design-system/pages/<page>.md` override exists.

---

## 1. Architecture

The design system is **token-based** and **brand-driven**. Two CSS variables (`--brand-h`, `--brand-s`) control the entire visual identity. Change them, and the whole app re-themes automatically.

```
┌─────────────────────────────────────────────────────┐
│  BRAND AXIS    --brand-h: 217   --brand-s: 91%      │  ← edit these
├─────────────────────────────────────────────────────┤
│  BRAND SCALE   --brand-50 ... --brand-950           │  parametric
│  NEUTRAL SCALE --neutral-0 ... --neutral-950        │  static
├─────────────────────────────────────────────────────┤
│  SEMANTIC      --primary, --success, --warning,     │
│                --destructive, --info  (+ -soft)     │
│                --stage-*, --chart-*                 │
├─────────────────────────────────────────────────────┤
│  TAILWIND      bg-primary, text-stage-success-fg,   │
│                bg-brand-500, etc.                   │
└─────────────────────────────────────────────────────┘
```

**Files:**
- [`apps/web/src/index.css`](../src/index.css) — token definitions
- [`apps/web/tailwind.config.js`](../tailwind.config.js) — Tailwind class bindings
- [`design-system/BRAND.md`](BRAND.md) — how to swap brand
- [`design-system/CHEATSHEET.md`](CHEATSHEET.md) — quick reference
- [`design-system/COMPONENTS.md`](COMPONENTS.md) — component contracts

---

## 2. Color tokens

### Brand (parametric — drive everything)

Two independent axes. Each generates a 50–950 scale.

| Token | Tailwind | When to use |
|---|---|---|
| `--brand-50` … `--brand-950` | `bg-brand-50` … `bg-brand-950` | Primary hover tints, badges, soft backgrounds |
| `--brand-600` (default) | `bg-brand` / `bg-primary` | Primary CTAs |
| `--brand2-50` … `--brand2-950` | `bg-brand-2-50` … `bg-brand-2-950` | Secondary tints |
| `--brand2-600` (default) | `bg-accent-2` | Accent CTAs (premium / "active" states) |

### Neutral (static — surfaces, text, borders)

| Token | Tailwind | Use |
|---|---|---|
| `--neutral-0` | `bg-neutral-0` | Pure white surface (light mode) |
| `--neutral-50` … `--neutral-100` | `bg-neutral-50/100` | App background, muted surface |
| `--neutral-200` … `--neutral-300` | `border-neutral-200/300` | Borders, dividers |
| `--neutral-400` … `--neutral-500` | `text-neutral-400/500` | Secondary text, icons |
| `--neutral-700` … `--neutral-900` | `text-neutral-700/900` | Primary text |
| `--neutral-950` | `bg-neutral-950` | Dark mode surface |

### Semantic (meaning, not color)

| Token | Solid (filled) | Soft (tinted bg) | Use |
|---|---|---|---|
| `success` | `bg-success text-success-foreground` | `bg-success-soft text-success-soft-foreground` | "Done well" — completed, paid, available |
| `warning` | `bg-warning text-warning-foreground` | `bg-warning-soft text-warning-soft-foreground` | "Needs attention" — overdue soon, partial |
| `destructive` | `bg-destructive text-destructive-foreground` | `bg-destructive-soft text-destructive-soft-foreground` | "Failed" — error, cancelled, sold |
| `info` | `bg-info text-info-foreground` | `bg-info-soft text-info-soft-foreground` | Informational — booked, viewing |
| `accent-2` | `bg-accent-2 text-accent-2-foreground` | `bg-accent-2-soft text-accent-2-soft-foreground` | Secondary brand accent — premium tags, decorative variety |

### Pipeline stages (lead/deal/unit lifecycle)

Use these instead of raw color names. All have a paired `-foreground` token.

| Tone | Tailwind bg | Lifecycle meaning |
|---|---|---|
| `stage-neutral` | `bg-stage-neutral` | Pre-action, idle |
| `stage-progress` | `bg-stage-progress` | Early forward motion (brand-tinted) |
| `stage-active` | `bg-stage-active` | Mid-flow (violet-tinted) |
| `stage-info` | `bg-stage-info` | Informational mid-state |
| `stage-attention` | `bg-stage-attention` | Needs action (warning-tinted) |
| `stage-success` | `bg-stage-success` | Completed positively |
| `stage-danger` | `bg-stage-danger` | Failed/cancelled |

### Chart palette (categorical — for data viz)

`bg-chart-1` through `bg-chart-8`. `chart-1` is brand; others are coordinated distinguishable hues. Use these in series colors, never raw hex.

---

## 3. Typography

System font stack (no custom font dependency):

```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
             'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

| Role | Class | Notes |
|---|---|---|
| Display | `text-3xl font-semibold tracking-tight` | Page title, hero |
| H1 | `text-2xl font-semibold tracking-tight` | Section title |
| H2 | `text-xl font-semibold` | Subsection |
| H3 | `text-lg font-medium` | Card title |
| Body | `text-sm` | Default body |
| Body large | `text-base` | Long-form reading |
| Label | `text-xs font-medium uppercase tracking-wide text-muted-foreground` | Form labels, table headers |
| Mono numbers | `tabular-nums` | Money, dates, IDs in tables |

**Rules**
- Body never below 14px (`text-sm`); table cells may go to `text-xs` only for dense tables.
- Use `tabular-nums` on every numeric column or money display.
- Use `text-muted-foreground` (not `text-gray-500`) for secondary text.

---

## 4. Spacing & Layout

Tailwind's 4px base scale. Stick to: `2 / 3 / 4 / 6 / 8 / 12 / 16` for most cases.

### Page wrappers — pick the right shape

Every top-level page must use one of these three shapes for the outermost `<div>`:

| Page kind | Wrapper | When |
|---|---|---|
| **Content page** | `p-6 space-y-6 max-w-7xl mx-auto` | Dashboards, settings, reports, broker, commissions, compliance, contracts, activities, hot inbox — anywhere the page is "stack of cards/sections, scroll the body". |
| **Detail page** | `p-6 space-y-6 max-w-5xl mx-auto` | Single-record forms (Deal, Lead profile, Task) — narrower for readability. |
| **Shell page** | `flex flex-col h-full bg-background` | Pages with their own internal header + scroll panel (lists, tables, kanban): Leads, Deals, Units, Projects, Offers, Reservations, Payment Plans, Contacts, Settings, Finance/Project/Unit detail, Project settings. |

**Page title** in the header must be `text-xl font-semibold tracking-tight text-foreground`.

### Internal spacing

| Context | Padding | Gap |
|---|---|---|
| Card body (default shadcn) | `p-6` | `space-y-4` |
| Card compact (KPI tile) | `p-4` or `p-5` | `space-y-3` |
| Form field group | — | `space-y-4` |
| Button row | — | `gap-2` |
| Page section break | — | `space-y-6` |
| Modal content section | `px-6 py-5 space-y-4` | — |
| Header bar (in shell pages) | `px-4 sm:px-6 py-4` | — |

---

## 5. Shape (radius)

| Token | Tailwind | Use |
|---|---|---|
| `--radius-sm` (6px) | `rounded-sm` | Inline tags, dense badges |
| `--radius` (8px) | `rounded` | Default — buttons, inputs |
| `--radius-md` (10px) | `rounded-md` | Same as default in shadcn |
| `--radius-lg` (12px) | `rounded-lg` | Cards |
| `--radius-xl` (16px) | `rounded-xl` | Sheets, modals |
| `rounded-full` | — | Avatars, pills, status dots |

---

## 6. Elevation (shadows)

Theme-aware shadows that adapt to dark mode automatically.

| Token | Tailwind | Use |
|---|---|---|
| `--shadow-xs` | `shadow-xs` | Subtle inset (input focus rim) |
| `--shadow-sm` | `shadow-sm` / `shadow` | Cards at rest |
| `--shadow-md` | `shadow-md` | Cards on hover, popovers |
| `--shadow-lg` | `shadow-lg` | Dropdowns, tooltips |
| `--shadow-xl` | `shadow-xl` | Modals, sheets |

---

## 7. Motion

| Token | Tailwind | Duration | Use |
|---|---|---|---|
| `--duration-fast` | `duration-fast` | 120ms | Hover, focus, color shifts |
| `--duration-base` | `duration-base` | 200ms | Default — most state changes |
| `--duration-slow` | `duration-slow` | 320ms | Modal open, sheet slide, layout |

| Easing | Tailwind | Use |
|---|---|---|
| `--ease-out` | `ease-brand-out` | Entering — most common |
| `--ease-in` | `ease-brand-in` | Exiting (use ~70% of enter duration) |
| `--ease-in-out` | `ease-brand-in-out` | Symmetric transitions |

**Rules**
- Animate `transform` and `opacity` only (never `width`/`height`/`top`/`left`).
- Respect `prefers-reduced-motion` — done by `tailwindcss-animate` automatically.
- Exit animations should be 60–70% the duration of enter.

---

## 8. Anti-patterns (do not do)

❌ `bg-blue-500`, `text-gray-600`, `border-emerald-200` — never use Tailwind palette colors directly. Use semantic tokens.
❌ `style={{ backgroundColor: '#3b82f6' }}` — never inline raw hex/rgb.
❌ `text-blue-500 dark:text-blue-400` — semantic tokens already handle dark mode.
❌ `LEAD_STAGE_HEX` — replaced by `LEAD_STAGE_CHART_VAR` returning CSS var names.
❌ Mixing solid + soft variants on the same surface (e.g., `bg-success-soft text-success-foreground`).
❌ Hardcoded shadow values (`shadow-[0_4px_8px_rgba(0,0,0,0.1)]`) — use the shadow tokens.

---

## 9. How to apply this system

When building or refactoring a component:

1. **Read this file** + relevant page override (`design-system/pages/<page>.md`) if exists.
2. **Use semantic tokens first** — `bg-primary`, `text-muted-foreground`, `bg-stage-success`.
3. **Only drop to brand scale** (`bg-brand-100`) when no semantic token fits — and add a comment explaining why.
4. **Never import** from raw Tailwind palette (`bg-blue-*`, `text-emerald-*`, etc.).
5. **Run** `pnpm build` to verify.

When adding a new pattern (e.g., a "trend up/down" tone) that's not in this doc:
1. Propose it as a new semantic token in `index.css`.
2. Document it here.
3. Then use it.
