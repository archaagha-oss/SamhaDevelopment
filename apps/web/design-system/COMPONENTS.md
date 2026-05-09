# Component Contracts

How to build/refactor components so they stay on-system. Every UI component must follow the rules in [`MASTER.md`](MASTER.md); this file documents the contracts for our shared components.

---

## Primitives ([`src/components/ui/`](../src/components/ui))

These are the foundation — they wrap Radix or are pure shadcn primitives. Already token-clean. Do not touch their styling unless updating the token system itself.

| Component | API contract |
|---|---|
| `Button` | Variants: `default \| destructive \| outline \| secondary \| ghost \| link \| success`. Sizes: `default \| sm \| lg \| icon`. Always uses tokens. |
| `Card` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. Resting `shadow-sm`. Padding `p-6` (compact composers may override to `p-4`). |
| `Badge` | Variants: `default \| secondary \| destructive \| outline \| success \| warning \| info \| muted`. Use `success-soft`-style soft variants for tinted badges. |
| `Input`, `Textarea`, `Select` | Use `border-input`, `bg-background`, `focus-visible:ring-ring`. Min height 40px (touch). |
| `Dialog`, `Sheet` | `rounded-xl`, `shadow-xl`. Animate via `tailwindcss-animate` defaults. |
| `Dropdown`, `Popover`, `Tooltip` | `shadow-lg`, `rounded-md`, `bg-popover`. |
| `Table` | Header: `text-xs font-medium uppercase tracking-wide text-muted-foreground`. Money columns: `tabular-nums`. |
| `Skeleton` | `bg-muted animate-pulse`. |
| `StageBadge` | Pass `stage` + `kind="lead" \| "deal"`. Maps to semantic stage tones. Don't bypass with a custom badge. |

---

## Feature components

### Cards (KPI tiles, summaries)

```tsx
<Card>
  <CardHeader className="pb-2">
    <CardDescription className="text-xs uppercase tracking-wide">
      Total leads
    </CardDescription>
    <CardTitle className="text-2xl font-semibold tabular-nums">
      1,284
    </CardTitle>
  </CardHeader>
  <CardContent className="pt-0">
    <div className="flex items-center gap-1.5 text-sm text-success">
      <TrendingUp className="size-4" />
      <span className="tabular-nums">+12.4%</span>
      <span className="text-muted-foreground">vs last week</span>
    </div>
  </CardContent>
</Card>
```

**Rules**
- Always `tabular-nums` on the metric value.
- Trend deltas: `text-success` for up, `text-destructive` for down, `text-muted-foreground` for flat.
- Description in uppercase label style.

### Status / stage indicators

Three patterns — pick the right one for context:

| Pattern | When | Example |
|---|---|---|
| **`<StageBadge>`** | Lead/deal pipeline stage | `<StageBadge stage="QUALIFIED" />` |
| **Soft badge** | Boolean/state ("Active", "Verified") | `<Badge variant="success">Active</Badge>` |
| **Dot + label** | Compact rows, legends | `<span className="size-2 rounded-full bg-success" /> Available` |

Never invent a new color scheme inline.

### Forms

```tsx
<form className="space-y-6">
  <div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" />
    <p className="text-xs text-muted-foreground">We'll never share this.</p>
  </div>
  {/* … */}
</form>
```

**Rules**
- Visible `<Label>` per input (never placeholder-only).
- Helper text uses `text-muted-foreground`, error text uses `text-destructive`.
- Errors below the field, not at the top.
- Required fields: append `<span className="text-destructive">*</span>` to the label.

### Tables

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead className="text-right">Amount</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map(r => (
      <TableRow key={r.id}>
        <TableCell>{r.name}</TableCell>
        <TableCell className="text-right tabular-nums">{r.amount}</TableCell>
        <TableCell><StageBadge stage={r.stage} kind="deal" /></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Rules**
- Money/numeric columns: `text-right tabular-nums`.
- Empty state: render an `<EmptyState>` instead of an empty tbody.
- Loading: render `<Skeleton>` rows (don't show empty body with spinner above).

### Empty states

```tsx
<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
  <Inbox className="size-10 text-muted-foreground" />
  <div className="space-y-1">
    <h3 className="font-medium">No leads yet</h3>
    <p className="text-sm text-muted-foreground">
      Add your first lead to start tracking conversations.
    </p>
  </div>
  <Button>Add lead</Button>
</div>
```

**Rules**
- Always include: icon, headline, description, primary action.
- Background: nothing (transparent) or `bg-muted/30` if needed.
- Border: `border-dashed border-border`.

### Modals / Sheets

```tsx
<Dialog>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Edit lead</DialogTitle>
      <DialogDescription>
        Update the contact information for this lead.
      </DialogDescription>
    </DialogHeader>
    {/* form */}
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Rules**
- Title is sentence case ("Edit lead", not "Edit Lead").
- Footer: secondary action on the left (`outline`), primary on the right (filled).
- Destructive confirmation modals: use `variant="destructive"` for the action button + always require an explicit "Cancel".

### Charts (Recharts)

```tsx
import { LEAD_STAGE_CHART_VAR } from "@/components/ui/stage-badge";

const series = data.map(d => ({
  name: d.stage,
  value: d.count,
  fill: `hsl(var(${LEAD_STAGE_CHART_VAR[d.stage] ?? "--chart-1"}))`,
}));

<BarChart data={series}>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
  <XAxis stroke="hsl(var(--muted-foreground))" />
  <YAxis stroke="hsl(var(--muted-foreground))" />
  <Tooltip
    contentStyle={{
      backgroundColor: "hsl(var(--popover))",
      borderColor: "hsl(var(--border))",
      borderRadius: "var(--radius-md)",
      color: "hsl(var(--popover-foreground))",
    }}
  />
  <Bar dataKey="value" />
</BarChart>
```

**Rules**
- Series colors come from `--chart-*` or `--stage-*` CSS vars, never hex.
- Tooltip styled with tokens so it works in dark mode.
- Always include a legend or direct labels.

### Toast (Sonner)

Already provided by `sonner`. Default props inherit token colors from the wrapper config. Use semantic intents:

```ts
toast.success("Lead saved");
toast.error("Failed to save");
toast.warning("Email already exists for another lead");
toast.info("Sync running");
```

Auto-dismiss after 3–5s. Always include an action button if a corrective action is possible.

---

## Adding a new component

1. **Check primitives first.** If `Button`, `Card`, `Badge` etc. cover the need, compose them.
2. **Use only tokens.** No raw Tailwind palette colors. No inline hex.
3. **Document the contract** in this file (variant matrix, rules).
4. **Test light + dark mode** before merge.
5. **Verify focus states** are visible (`focus-visible:ring-2 focus-visible:ring-ring`).
6. **Verify touch targets** ≥ 40px height for tappable elements.

---

## Migration checklist (during the sweep)

For each existing component being touched:

- [ ] Replace `bg-{color}-{n}` / `text-{color}-{n}` / `border-{color}-{n}` with semantic tokens
- [ ] Replace inline `style={{ color, backgroundColor }}` with classes
- [ ] Replace `dark:bg-…` overrides — semantic tokens already handle dark mode
- [ ] Replace hardcoded `rgb(…)`, `#hex` with tokens or `hsl(var(--…))`
- [ ] Replace `shadow-[…]` arbitrary shadows with `shadow-sm/md/lg/xl`
- [ ] Replace ad-hoc `rounded-[…]` with `rounded-md/lg/xl`
- [ ] Verify contrast in both themes
- [ ] Verify `<StageBadge>` is used instead of bespoke colored badges for pipeline stages
