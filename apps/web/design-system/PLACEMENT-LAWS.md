# Placement Laws

The rules every page in `apps/web` follows. The goal is **predictability**: a user who has used Contacts should know where the search, primary action, and filters live on Deals — without looking.

These laws are enforced by composition, not just convention. Use the primitives in [`components/layout`](../src/components/layout) and [`components/data`](../src/components/data); when you do, the laws follow automatically.

---

## The eleven laws

1. **Primary action lives top-right of `PageHeader`.** Pass it via the `actions` prop. Never inline with filters, never floating, never in the body.

2. **Search lives top-left of `FilterBar`.** Always the first child via the `search` prop. On mobile it grows to fill width.

3. **Filter dropdowns sit immediately right of search** in `FilterBar` via the `filters` prop. Inline on desktop, wrap on mobile. Every dropdown has an "All …" option as its first entry.

4. **Active filters render immediately under `FilterBar`** as removable `<Badge>`-style chips, with a "Clear all" link when more than one is active. Always — no exceptions. Use `<ActiveFilterChips>`.

5. **Breadcrumbs are the first child of `PageHeader`.** Pass via the `crumbs` prop. The header is `bg-card`, so the wrapped `<Breadcrumbs>` uses `variant="light"` automatically.

6. **Modal footer:** secondary action on the LEFT, primary on the RIGHT. Use the existing `DialogFooter` from `components/ui/dialog.tsx`. Never full-width 50/50 split. Never primary-on-left.

7. **Button labels follow one set of verbs:**
   - `Create X` for new items (e.g. "Create lead", "Create contact").
   - `Save changes` for edits (one phrase, app-wide).
   - `Delete` for destructive actions (`variant="destructive"`).
   - `Cancel` for closing without action.
   - Sentence case. No emoji. No mixing `Save` / `Submit` / `Confirm`.

8. **No raw `bg-primary` button strings.** Every button uses `<Button>` from `components/ui/button.tsx` with a `variant`. If you find yourself reaching for `className="px-3 py-1.5 bg-primary..."`, stop and use the primitive.

9. **All filter chips and active-filter chips use the same visual.** Render via `<ActiveFilterChips>`. For stage tokens with their tone palette, use `<StageBadge>` — never invent a new chip style.

10. **Page width:** `width="default"` (`max-w-7xl mx-auto`) on `PageContainer` for everything. Dashboards may use `width="wide"`. Print pages bypass `PageContainer` entirely.

11. **Sticky header:** `PageHeader` is `sticky top-0 z-10 bg-card border-b` (default). Don't override unless the page is print-only.

---

## Canonical composition

Every list page composes the same way:

```tsx
import { PageContainer, PageHeader } from "@/components/layout";
import { FilterBar, ActiveFilterChips, Pagination } from "@/components/data";
import { Button } from "@/components/ui/button";

export default function ContactsPage() {
  // …state…

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Contacts" }]}
        title="Contacts"
        subtitle={`${total.toLocaleString()} contacts · address book for communication`}
        actions={<Button onClick={openCreate}>Create contact</Button>}
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-4">
            <FilterBar
              search={{ value: search, onChange: setSearch, placeholder: "Search name, email, phone…" }}
              filters={[
                { key: "source", label: "Source", value: source, onChange: setSource, options: SOURCE_OPTS },
              ]}
            />
            <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
            {/* table content here */}
            <Pagination page={page} pageSize={50} total={total} onPageChange={setPage} />
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
```

---

## Detail pages

Detail pages (Lead profile, Deal detail, Unit detail, Member detail) compose with `<DetailPageLayout>` from [`components/layout`](../src/components/layout/DetailPageLayout.tsx). It is the canonical shape for any single-record page. The reference implementation is [`pages/MemberDetailPage.tsx`](../src/pages/MemberDetailPage.tsx).

Slots: `crumbs`, `title`, `subtitle`, `actions`, `tabs` (forwarded to `PageHeader`); `hero` (e.g. avatar block), `kpis`, `main` (left, 2/3, required), `aside` (right, 1/3, sticky on desktop, optional). Width is `max-w-5xl` (per [MASTER.md §4](MASTER.md)).

**Edit flows are also full pages, never modals.** A record at `/entity/:id` is read-only; clicking "Edit" navigates to `/entity/:id/edit` which renders the same `<DetailPageLayout>` with fields-as-inputs. Saving navigates back. New-record creation lives at `/entity/new` and uses the same edit page (the `:id` param is absent).

---

## What this is NOT

- **Not a visual redesign.** Tailwind tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-success-soft`, etc.) are unchanged. Button variants are unchanged. Colors are unchanged.
- **Not a new component library.** It's six small primitives that compose existing pieces (`<Button>`, `<Badge>`, `<Breadcrumbs>`, `<EmptyState>`, `<SkeletonTableRows>`).
- **Not optional.** A page that doesn't follow the laws is a page the user has to re-learn. Don't ship it.

---

## When you need to break a law

Sometimes a page genuinely doesn't fit (print pages bypass `AppShell`; dashboards may want a different padding). Document **why** in the PR description, and prefer extending a primitive over working around it. If you find yourself needing a sixth `width` value or a new `padding` mode, that's a signal to update the primitive — not to inline a one-off.

---

## Reference implementation

[`apps/web/src/pages/ContactsPage.tsx`](../src/pages/ContactsPage.tsx) is the canonical example after Phase 1. Read it when you're not sure what a list page should look like.
