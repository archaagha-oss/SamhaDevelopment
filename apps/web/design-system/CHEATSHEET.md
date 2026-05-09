# Cheatsheet — Tokens at a Glance

Quick lookup for which class to use. For deeper explanation see [`MASTER.md`](MASTER.md).

---

## "I want a colored thing"

| If you want… | Use this | Not this |
|---|---|---|
| Primary CTA button | `bg-primary text-primary-foreground` | `bg-blue-600 text-white` |
| Secondary CTA | `bg-secondary text-secondary-foreground` | `bg-gray-100 text-gray-900` |
| Outlined CTA | `border bg-background hover:bg-accent` | `border-gray-300 hover:bg-gray-50` |
| Danger button (delete) | `bg-destructive text-destructive-foreground` | `bg-red-600 text-white` |
| Success toast | `bg-success text-success-foreground` | `bg-green-600 text-white` |
| Subtle success badge | `bg-success-soft text-success-soft-foreground` | `bg-green-50 text-green-700` |
| Subtle warning badge | `bg-warning-soft text-warning-soft-foreground` | `bg-amber-50 text-amber-700` |
| Subtle info badge | `bg-info-soft text-info-soft-foreground` | `bg-blue-50 text-blue-700` |
| Page background | `bg-background` | `bg-white` |
| Card surface | `bg-card text-card-foreground` | `bg-white` |
| Muted/section bg | `bg-muted` | `bg-gray-50` |
| Subtle text | `text-muted-foreground` | `text-gray-500` |
| Body text | `text-foreground` | `text-gray-900` |
| Border | `border-border` (or just `border`) | `border-gray-200` |
| Input border | `border-input` | `border-gray-300` |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-ring` | `ring-blue-500` |
| Link text | `text-primary hover:underline` | `text-blue-600` |
| Status dot — success | `bg-success` | `bg-green-500` |
| Status dot — warning | `bg-warning` | `bg-amber-500` |
| Status dot — destructive | `bg-destructive` | `bg-red-500` |
| Status dot — info | `bg-info` | `bg-sky-500` |
| Status dot — neutral | `bg-neutral-400` | `bg-gray-400` |
| Lifecycle stage badge | `bg-stage-<tone> text-stage-<tone>-foreground` | hardcoded color classes |

---

## Lifecycle stage tones

`<tone>` = `neutral | progress | active | info | attention | success | danger`

| Tone | When |
|---|---|
| `neutral` | NEW, NOT_RELEASED, BLOCKED, RESERVATION_PENDING |
| `progress` | CONTACTED, RESERVATION_CONFIRMED |
| `active` | QUALIFIED, SPA_SIGNED, PROPOSAL |
| `info` | VIEWING, BOOKED, INSTALLMENTS_ACTIVE, OQOOD_REGISTERED |
| `attention` | NEGOTIATING, OQOOD_PENDING, RESERVED, ON_HOLD, OVERDUE |
| `success` | CLOSED_WON, COMPLETED, AVAILABLE, PAID, HANDED_OVER |
| `danger` | CLOSED_LOST, CANCELLED, SOLD |

Or use the `<StageBadge stage={stage} kind="lead" />` component which maps automatically.

---

## Brand scale (for soft tints/hover states)

Use these only when no semantic token fits. Examples: a hover background tint that's brand-flavored, a non-CTA accent that needs to be brand-coordinated.

```
bg-brand-50   bg-brand-100   bg-brand-200   bg-brand-300   bg-brand-400
bg-brand-500  bg-brand-600   bg-brand-700   bg-brand-800   bg-brand-900   bg-brand-950
```

Same exists for `text-` and `border-`.

---

## Charts (recharts series)

```tsx
const seriesColors = [
  "hsl(var(--chart-1))",  // brand
  "hsl(var(--chart-2))",  // emerald
  "hsl(var(--chart-3))",  // amber
  "hsl(var(--chart-4))",  // violet
  "hsl(var(--chart-5))",  // cyan
  "hsl(var(--chart-6))",  // red
  "hsl(var(--chart-7))",  // fuchsia
  "hsl(var(--chart-8))",  // orange
];
```

Or in Tailwind classes (for `<svg fill>`/CSS): `fill-chart-1`, `bg-chart-2`, etc.

---

## Text size scale

| Use | Class |
|---|---|
| Page title | `text-3xl font-semibold tracking-tight` |
| Section title | `text-2xl font-semibold tracking-tight` |
| Subsection | `text-xl font-semibold` |
| Card title | `text-lg font-medium` |
| Body | `text-sm` |
| Body large | `text-base` |
| Small / caption | `text-xs` |
| Label | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |
| Money / data | add `tabular-nums` |

---

## Radius

| Element | Class |
|---|---|
| Buttons, inputs | default (`rounded` or component default) |
| Cards | `rounded-lg` |
| Modals, sheets | `rounded-xl` |
| Avatars, pills | `rounded-full` |

---

## Shadows

| Element | Class |
|---|---|
| Card resting | `shadow-sm` |
| Card hover | `shadow-md` |
| Popover, dropdown | `shadow-lg` |
| Modal | `shadow-xl` |

---

## Motion

```
duration-fast    →  120ms  (hover)
duration-base    →  200ms  (default)
duration-slow    →  320ms  (modal/sheet)

ease-brand-out    →  enter
ease-brand-in     →  exit (use ~70% duration of enter)
ease-brand-in-out →  symmetric
```

Animate **only** `transform` and `opacity`.

---

## When to use which

```
┌──────────────────────────────────────────────────────────┐
│  PURPOSE              →  TOKEN                            │
├──────────────────────────────────────────────────────────┤
│  Brand identity       →  primary, brand-*, info           │
│  Meaning (semantic)   →  success, warning, destructive    │
│  Lifecycle/status     →  stage-*                          │
│  Surface/layout       →  background, card, muted, border  │
│  Text hierarchy       →  foreground, muted-foreground     │
│  Data viz             →  chart-1 .. chart-8               │
└──────────────────────────────────────────────────────────┘
```
