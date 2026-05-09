# Brand Colors — Two-Axis Theming

The app has **two brand axes**, each controlled by an HSL hue/saturation pair:

| Axis | Hue var | Sat var | Default | Drives |
|---|---|---|---|---|
| **Primary** | `--brand-h` | `--brand-s` | `217 / 91%` (Ocean blue) | Primary CTAs, focus rings, links, info-soft, stage-progress, chart-1 |
| **Secondary** | `--brand2-h` | `--brand2-s` | `262 / 65%` (Violet) | Accent CTAs (`accent-2`), stage-active, chart-2, premium tags |

Change either pair in [`apps/web/src/index.css`](../src/index.css) and every surface tied to that axis follows. The two axes are **independent** — they can be re-themed separately or together.

Tenants set both via Settings → Company tab; the values are stored as hex in `AppSettings.primaryColor` / `AppSettings.secondaryColor` and applied at runtime via `applyBrandFromHex` / `applyBrand2FromHex` (see [`SettingsContext.tsx`](../src/contexts/SettingsContext.tsx)).

---

## How it works

```css
:root {
  --brand-h: 217;     /* hue 0–360 */
  --brand-s: 91%;     /* saturation 0–100% */
}
```

The full brand scale (`--brand-50` through `--brand-950`) is **derived** from those two values plus a fixed lightness ramp. So "rotating the brand" is one edit.

What follows the brand:
- `--primary`, `--ring` (CTAs, focus)
- `--info`, `--info-soft` (informational badges, links)
- `--stage-progress`, `--stage-info` (lifecycle stages)
- `--chart-1` (first chart series)

What does **not** follow the brand:
- `--success`, `--warning`, `--destructive` — meaning is fixed (green/amber/red).
- Neutrals (text, surfaces, borders).

---

## Primary presets (driven from Settings UI)

| Brand | Hex | `--brand-h` | `--brand-s` | Vibe |
|---|---|---|---|---|
| **Ocean** (default) | `#2563eb` | `217` | `91%` | Trustworthy, corporate, fintech-friendly |
| **Indigo** | `#4f46e5` | `239` | `84%` | Refined, premium, SaaS |
| **Violet** | `#7c3aed` | `262` | `83%` | Premium, creative, fashion/beauty |
| **Teal** | `#0d9488` | `188` | `86%` | Calm, healthcare, modern |
| **Emerald** | `#16a34a` | `152` | `76%` | Eco, growth, fintech (positive) |
| **Amber** | `#d97706` | `38` | `92%` | Warm, hospitality, energetic |
| **Orange** | `#ea580c` | `25` | `95%` | Bold, energetic, retail |
| **Crimson** | `#dc2626` | `0` | `84%` | Urgent, food, sport |
| **Slate** | `#475569` | `222` | `25%` | Minimal, monochrome, editorial |

## Secondary presets (driven from Settings UI)

Picked to pair well with most primaries.

| Accent | Hex | `--brand2-h` | `--brand2-s` |
|---|---|---|---|
| **Violet** (default) | `#7c3aed` | `262` | `65%` |
| **Magenta** | `#c026d3` | `293` | `69%` |
| **Pink** | `#db2777` | `330` | `73%` |
| **Rose** | `#e11d48` | `348` | `78%` |
| **Sky** | `#0284c7` | `200` | `97%` |
| **Cyan** | `#0891b2` | `192` | `91%` |
| **Lime** | `#65a30d` | `83` | `85%` |
| **Gold** | `#ca8a04` | `42` | `94%` |
| **Charcoal** | `#334155` | `217` | `19%` |

Try one out:

```css
/* in apps/web/src/index.css */
:root {
  --brand-h: 25;
  --brand-s: 95%;
  /* …everything else stays the same */
}
```

---

## Runtime swap (optional)

To let users pick a brand from the UI (e.g., per-tenant white-label), set the variables at runtime:

```ts
// e.g., apps/web/src/lib/setBrand.ts
export function setBrand(hue: number, saturation: number) {
  const root = document.documentElement;
  root.style.setProperty("--brand-h", String(hue));
  root.style.setProperty("--brand-s", `${saturation}%`);
}

// Usage:
setBrand(25, 95); // orange
```

The whole UI repaints instantly because every brand-driven token references those two variables.

---

## Multi-tenant brand (per-org)

If different organizations need different brands within the same deployment, scope the variables to a wrapper:

```tsx
<div data-org={orgId} style={brandStyleFor(orgId)}>
  <App />
</div>
```

```ts
function brandStyleFor(orgId: string): React.CSSProperties {
  const { hue, saturation } = ORG_BRANDS[orgId] ?? { hue: 217, saturation: 91 };
  return {
    "--brand-h": String(hue),
    "--brand-s": `${saturation}%`,
  } as React.CSSProperties;
}
```

---

## Picking a custom hue

1. Open any HSL color picker (e.g., the dev tools color picker on a `hsl(217 91% 45%)` value).
2. Adjust hue to taste — keep saturation **70–95%** for vibrant brands, or drop to **20–40%** for muted/editorial brands.
3. Verify contrast: `--brand-600` (used as primary on white) must be at least 4.5:1 on white background. Lightness ≤ 48% almost always passes.
4. Test in dark mode — primary becomes `--brand-500` there, which is one step lighter.

---

## Verifying after a brand change

After changing `--brand-h` / `--brand-s`:

- [ ] Primary CTA button still legible (foreground text contrast ≥ 4.5:1)
- [ ] Focus rings visible against backgrounds
- [ ] Link underlines / hover states still distinct from body text
- [ ] Soft `bg-brand-50` / `bg-brand-100` not too vibrant (raise hue if so)
- [ ] Charts still distinguishable (chart-1 shouldn't collide with chart-2)
- [ ] Dark mode looks intentional (run through both modes)
