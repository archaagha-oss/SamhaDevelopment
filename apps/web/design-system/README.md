# Samha CRM — Design System

Token-based, brand-driven design system. One CSS variable change rotates the whole theme.

## Start here

| File | Read when |
|---|---|
| [`MASTER.md`](MASTER.md) | Building or refactoring any component |
| [`CHEATSHEET.md`](CHEATSHEET.md) | Quick lookup — "which class do I use?" |
| [`BRAND.md`](BRAND.md) | Changing the brand color (hue/saturation) |
| [`COMPONENTS.md`](COMPONENTS.md) | Component contracts (cards, forms, tables, modals, charts) |
| `pages/<page>.md` | Per-page deviations from MASTER (created on-demand) |

## Source of truth

Token definitions live in [`apps/web/src/index.css`](../src/index.css). Tailwind class bindings in [`apps/web/tailwind.config.js`](../tailwind.config.js).

## Workflow when building a page

1. Open `MASTER.md` for global rules.
2. Check `pages/<page-name>.md` — if it exists, its rules override MASTER.
3. Build with semantic tokens (`bg-primary`, `text-stage-success-foreground`, etc.).
4. If you find yourself reaching for raw Tailwind palette (`bg-blue-500`), stop and use a semantic token instead.
5. If no semantic token fits and you genuinely need a brand-tinted variant, use the `brand-*` scale — and document the deviation in `pages/<page>.md`.
