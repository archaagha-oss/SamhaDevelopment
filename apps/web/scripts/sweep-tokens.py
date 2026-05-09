#!/usr/bin/env python3
"""
One-shot sweep: replace hardcoded Tailwind palette colors with design-system tokens.

Run from apps/web:
    python3 scripts/sweep-tokens.py            # apply
    python3 scripts/sweep-tokens.py --dry-run  # preview only

Mappings reflect design-system/MASTER.md. Mostly mechanical:
- slate/gray/zinc/stone   -> neutral semantic tokens
- red / rose              -> destructive
- emerald / green / lime  -> success
- amber / yellow / orange -> warning
- blue                    -> primary (solid) / info-soft (tints)
- sky                     -> info-soft / chart-5
- cyan / teal             -> chart-5
- indigo / violet         -> chart-4 / stage-active
- purple / pink / fuchsia -> chart-7

Skipped: stage-badge.tsx, constants/colors.ts, utils/statusColors.ts (already token-clean).
"""
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src"
SKIP_NAMES = {
    "stage-badge.tsx",
    "colors.ts",
    "statusColors.ts",
    "ExecutiveDashboard.tsx",
    "LeadsPage.tsx",
}

# Order: specific shades before generic. Each tuple: (regex, replacement)
# The (?![\d/]) lookahead prevents bg-slate-50 matching inside bg-slate-500 or bg-slate-50/30.
SUBS: list[tuple[str, str]] = [
    # =============================================================
    # Hover variants (darker shades) -> token /90
    # =============================================================
    (r"\bhover:bg-blue-700(?![\d/])",      "hover:bg-primary/90"),
    (r"\bhover:bg-blue-800(?![\d/])",      "hover:bg-primary/80"),
    (r"\bhover:bg-emerald-700(?![\d/])",   "hover:bg-success/90"),
    (r"\bhover:bg-green-700(?![\d/])",     "hover:bg-success/90"),
    (r"\bhover:bg-red-700(?![\d/])",       "hover:bg-destructive/90"),
    (r"\bhover:bg-amber-600(?![\d/])",     "hover:bg-warning/90"),
    (r"\bhover:bg-yellow-600(?![\d/])",    "hover:bg-warning/90"),
    (r"\bhover:bg-orange-700(?![\d/])",    "hover:bg-warning/90"),

    # Hover light tints
    (r"\bhover:bg-blue-50(?![\d/])",       "hover:bg-info-soft"),
    (r"\bhover:bg-emerald-50(?![\d/])",    "hover:bg-success-soft"),
    (r"\bhover:bg-green-50(?![\d/])",      "hover:bg-success-soft"),
    (r"\bhover:bg-red-50(?![\d/])",        "hover:bg-destructive-soft"),
    (r"\bhover:bg-amber-50(?![\d/])",      "hover:bg-warning-soft"),
    (r"\bhover:bg-orange-50(?![\d/])",     "hover:bg-warning-soft"),

    (r"\bhover:bg-(?:slate|gray|zinc|stone)-50(?![\d/])",  "hover:bg-muted/50"),
    (r"\bhover:bg-(?:slate|gray|zinc|stone)-100(?![\d/])", "hover:bg-muted"),
    (r"\bhover:bg-(?:slate|gray|zinc|stone)-200(?![\d/])", "hover:bg-muted"),
    (r"\bhover:bg-(?:slate|gray|zinc|stone)-700(?![\d/])", "hover:bg-muted"),
    (r"\bhover:bg-(?:slate|gray|zinc|stone)-800(?![\d/])", "hover:bg-muted"),

    (r"\bhover:text-blue-\d+(?![\d/])",          "hover:text-primary"),
    (r"\bhover:text-(?:slate|gray)-\d+(?![\d/])", "hover:text-foreground"),
    (r"\bhover:text-emerald-\d+(?![\d/])",        "hover:text-success"),
    (r"\bhover:text-red-\d+(?![\d/])",            "hover:text-destructive"),
    (r"\bhover:text-amber-\d+(?![\d/])",          "hover:text-warning"),
    (r"\bhover:border-blue-\d+(?![\d/])",         "hover:border-primary/40"),
    (r"\bhover:border-(?:slate|gray)-\d+(?![\d/])", "hover:border-border"),

    # Group-hover
    (r"\bgroup-hover:text-blue-\d+(?![\d/])",   "group-hover:text-primary"),
    (r"\bgroup-hover:bg-blue-\d+(?![\d/])",     "group-hover:bg-primary"),

    # Focus
    (r"\bfocus:border-blue-\d+(?![\d/])",  "focus:border-ring"),
    (r"\bfocus:ring-blue-\d+(?![\d/])",    "focus:ring-ring"),
    (r"\bfocus:ring-(?:slate|gray)-\d+(?![\d/])", "focus:ring-ring"),
    (r"\bfocus:border-(?:slate|gray)-\d+(?![\d/])", "focus:border-ring"),

    # =============================================================
    # NEUTRAL palettes (slate / gray / zinc / stone) -> tokens
    # =============================================================
    (r"\bbg-(?:slate|gray|zinc|stone)-950(?![\d/])",  "bg-background"),
    (r"\bbg-(?:slate|gray|zinc|stone)-900(?![\d/])",  "bg-card"),
    (r"\bbg-(?:slate|gray|zinc|stone)-800(?![\d/])",  "bg-muted"),
    (r"\bbg-(?:slate|gray|zinc|stone)-700(?![\d/])",  "bg-neutral-700"),
    (r"\bbg-(?:slate|gray|zinc|stone)-600(?![\d/])",  "bg-neutral-600"),
    (r"\bbg-(?:slate|gray|zinc|stone)-500(?![\d/])",  "bg-neutral-500"),
    (r"\bbg-(?:slate|gray|zinc|stone)-400(?![\d/])",  "bg-neutral-400"),
    (r"\bbg-(?:slate|gray|zinc|stone)-300(?![\d/])",  "bg-neutral-300"),
    (r"\bbg-(?:slate|gray|zinc|stone)-200(?![\d/])",  "bg-neutral-200"),
    (r"\bbg-(?:slate|gray|zinc|stone)-100(?![\d/])",  "bg-muted"),
    (r"\bbg-(?:slate|gray|zinc|stone)-50(?![\d/])",   "bg-muted/50"),

    (r"\btext-(?:slate|gray|zinc|stone)-50(?![\d/])",   "text-foreground"),
    (r"\btext-(?:slate|gray|zinc|stone)-100(?![\d/])",  "text-foreground"),
    (r"\btext-(?:slate|gray|zinc|stone)-200(?![\d/])",  "text-foreground"),
    (r"\btext-(?:slate|gray|zinc|stone)-300(?![\d/])",  "text-foreground/80"),
    (r"\btext-(?:slate|gray|zinc|stone)-400(?![\d/])",  "text-muted-foreground"),
    (r"\btext-(?:slate|gray|zinc|stone)-500(?![\d/])",  "text-muted-foreground"),
    (r"\btext-(?:slate|gray|zinc|stone)-600(?![\d/])",  "text-muted-foreground"),
    (r"\btext-(?:slate|gray|zinc|stone)-700(?![\d/])",  "text-foreground"),
    (r"\btext-(?:slate|gray|zinc|stone)-800(?![\d/])",  "text-foreground"),
    (r"\btext-(?:slate|gray|zinc|stone)-900(?![\d/])",  "text-foreground"),

    (r"\bborder-(?:slate|gray|zinc|stone)-\d+(?![\d/])", "border-border"),
    (r"\bdivide-(?:slate|gray|zinc|stone)-\d+(?![\d/])", "divide-border"),
    (r"\bring-(?:slate|gray|zinc|stone)-\d+(?![\d/])",   "ring-ring"),

    # =============================================================
    # RED / ROSE -> destructive
    # =============================================================
    (r"\bbg-(?:red|rose)-50(?![\d/])",   "bg-destructive-soft"),
    (r"\bbg-(?:red|rose)-100(?![\d/])",  "bg-destructive-soft"),
    (r"\bbg-(?:red|rose)-200(?![\d/])",  "bg-destructive/30"),
    (r"\bbg-(?:red|rose)-300(?![\d/])",  "bg-destructive/50"),
    (r"\bbg-(?:red|rose)-400(?![\d/])",  "bg-destructive/70"),
    (r"\bbg-(?:red|rose)-500(?![\d/])",  "bg-destructive"),
    (r"\bbg-(?:red|rose)-600(?![\d/])",  "bg-destructive"),
    (r"\bbg-(?:red|rose)-700(?![\d/])",  "bg-destructive"),
    (r"\bbg-(?:red|rose)-800(?![\d/])",  "bg-destructive"),
    (r"\btext-(?:red|rose)-300(?![\d/])", "text-destructive"),
    (r"\btext-(?:red|rose)-400(?![\d/])", "text-destructive"),
    (r"\btext-(?:red|rose)-500(?![\d/])", "text-destructive"),
    (r"\btext-(?:red|rose)-600(?![\d/])", "text-destructive"),
    (r"\btext-(?:red|rose)-700(?![\d/])", "text-destructive"),
    (r"\btext-(?:red|rose)-800(?![\d/])", "text-destructive-soft-foreground"),
    (r"\bborder-(?:red|rose)-\d+(?![\d/])", "border-destructive/30"),

    # =============================================================
    # GREENS (emerald / green / lime) -> success
    # =============================================================
    (r"\bbg-(?:emerald|green|lime)-50(?![\d/])",  "bg-success-soft"),
    (r"\bbg-(?:emerald|green|lime)-100(?![\d/])", "bg-success-soft"),
    (r"\bbg-(?:emerald|green|lime)-200(?![\d/])", "bg-success/30"),
    (r"\bbg-(?:emerald|green|lime)-300(?![\d/])", "bg-success/50"),
    (r"\bbg-(?:emerald|green|lime)-400(?![\d/])", "bg-success/70"),
    (r"\bbg-(?:emerald|green|lime)-500(?![\d/])", "bg-success"),
    (r"\bbg-(?:emerald|green|lime)-600(?![\d/])", "bg-success"),
    (r"\bbg-(?:emerald|green|lime)-700(?![\d/])", "bg-success"),
    (r"\bbg-(?:emerald|green|lime)-800(?![\d/])", "bg-success"),
    (r"\btext-(?:emerald|green|lime)-300(?![\d/])", "text-success"),
    (r"\btext-(?:emerald|green|lime)-400(?![\d/])", "text-success"),
    (r"\btext-(?:emerald|green|lime)-500(?![\d/])", "text-success"),
    (r"\btext-(?:emerald|green|lime)-600(?![\d/])", "text-success"),
    (r"\btext-(?:emerald|green|lime)-700(?![\d/])", "text-success"),
    (r"\btext-(?:emerald|green|lime)-800(?![\d/])", "text-success-soft-foreground"),
    (r"\bborder-(?:emerald|green|lime)-\d+(?![\d/])", "border-success/30"),

    # =============================================================
    # AMBER / YELLOW / ORANGE -> warning
    # =============================================================
    (r"\bbg-(?:amber|yellow|orange)-50(?![\d/])",  "bg-warning-soft"),
    (r"\bbg-(?:amber|yellow|orange)-100(?![\d/])", "bg-warning-soft"),
    (r"\bbg-(?:amber|yellow|orange)-200(?![\d/])", "bg-warning/30"),
    (r"\bbg-(?:amber|yellow|orange)-300(?![\d/])", "bg-warning/50"),
    (r"\bbg-(?:amber|yellow|orange)-400(?![\d/])", "bg-warning/70"),
    (r"\bbg-(?:amber|yellow|orange)-500(?![\d/])", "bg-warning"),
    (r"\bbg-(?:amber|yellow|orange)-600(?![\d/])", "bg-warning"),
    (r"\bbg-(?:amber|yellow|orange)-700(?![\d/])", "bg-warning"),
    (r"\btext-(?:amber|yellow|orange)-300(?![\d/])", "text-warning"),
    (r"\btext-(?:amber|yellow|orange)-400(?![\d/])", "text-warning"),
    (r"\btext-(?:amber|yellow|orange)-500(?![\d/])", "text-warning"),
    (r"\btext-(?:amber|yellow|orange)-600(?![\d/])", "text-warning"),
    (r"\btext-(?:amber|yellow|orange)-700(?![\d/])", "text-warning"),
    (r"\btext-(?:amber|yellow|orange)-800(?![\d/])", "text-warning-soft-foreground"),
    (r"\bborder-(?:amber|yellow|orange)-\d+(?![\d/])", "border-warning/30"),

    # =============================================================
    # BLUE -> primary (and tints to info-soft)
    # =============================================================
    (r"\bbg-blue-50(?![\d/])",  "bg-info-soft"),
    (r"\bbg-blue-100(?![\d/])", "bg-info-soft"),
    (r"\bbg-blue-200(?![\d/])", "bg-info/30"),
    (r"\bbg-blue-300(?![\d/])", "bg-primary/40"),
    (r"\bbg-blue-400(?![\d/])", "bg-primary/60"),
    (r"\bbg-blue-500(?![\d/])", "bg-primary"),
    (r"\bbg-blue-600(?![\d/])", "bg-primary"),
    (r"\bbg-blue-700(?![\d/])", "bg-primary"),
    (r"\bbg-blue-800(?![\d/])", "bg-primary"),
    (r"\btext-blue-300(?![\d/])", "text-primary"),
    (r"\btext-blue-400(?![\d/])", "text-primary"),
    (r"\btext-blue-500(?![\d/])", "text-primary"),
    (r"\btext-blue-600(?![\d/])", "text-primary"),
    (r"\btext-blue-700(?![\d/])", "text-primary"),
    (r"\btext-blue-800(?![\d/])", "text-primary"),
    (r"\bborder-blue-\d+(?![\d/])", "border-primary/40"),
    (r"\bring-blue-\d+(?![\d/])",   "ring-ring"),

    # =============================================================
    # SKY / CYAN / TEAL -> chart-5
    # =============================================================
    (r"\bbg-(?:sky|cyan|teal)-50(?![\d/])",  "bg-chart-5/10"),
    (r"\bbg-(?:sky|cyan|teal)-100(?![\d/])", "bg-chart-5/15"),
    (r"\bbg-(?:sky|cyan|teal)-200(?![\d/])", "bg-chart-5/30"),
    (r"\bbg-(?:sky|cyan|teal)-500(?![\d/])", "bg-chart-5"),
    (r"\bbg-(?:sky|cyan|teal)-600(?![\d/])", "bg-chart-5"),
    (r"\bbg-(?:sky|cyan|teal)-700(?![\d/])", "bg-chart-5"),
    (r"\btext-(?:sky|cyan|teal)-\d+(?![\d/])", "text-chart-5"),
    (r"\bborder-(?:sky|cyan|teal)-\d+(?![\d/])", "border-chart-5/30"),

    # =============================================================
    # INDIGO / VIOLET -> chart-4 (or stage-active for soft)
    # =============================================================
    (r"\bbg-(?:indigo|violet)-50(?![\d/])",  "bg-stage-active"),
    (r"\bbg-(?:indigo|violet)-100(?![\d/])", "bg-stage-active"),
    (r"\bbg-(?:indigo|violet)-200(?![\d/])", "bg-chart-4/30"),
    (r"\bbg-(?:indigo|violet)-500(?![\d/])", "bg-chart-4"),
    (r"\bbg-(?:indigo|violet)-600(?![\d/])", "bg-chart-4"),
    (r"\bbg-(?:indigo|violet)-700(?![\d/])", "bg-chart-4"),
    (r"\btext-(?:indigo|violet)-\d+(?![\d/])", "text-chart-4"),
    (r"\bborder-(?:indigo|violet)-\d+(?![\d/])", "border-chart-4/30"),

    # =============================================================
    # PURPLE / PINK / FUCHSIA -> chart-7
    # =============================================================
    (r"\bbg-(?:purple|pink|fuchsia)-50(?![\d/])",  "bg-chart-7/10"),
    (r"\bbg-(?:purple|pink|fuchsia)-100(?![\d/])", "bg-chart-7/15"),
    (r"\bbg-(?:purple|pink|fuchsia)-200(?![\d/])", "bg-chart-7/30"),
    (r"\bbg-(?:purple|pink|fuchsia)-500(?![\d/])", "bg-chart-7"),
    (r"\bbg-(?:purple|pink|fuchsia)-600(?![\d/])", "bg-chart-7"),
    (r"\bbg-(?:purple|pink|fuchsia)-700(?![\d/])", "bg-chart-7"),
    (r"\btext-(?:purple|pink|fuchsia)-\d+(?![\d/])", "text-chart-7"),
    (r"\bborder-(?:purple|pink|fuchsia)-\d+(?![\d/])", "border-chart-7/30"),

    # =============================================================
    # Opacity-suffix variants:  bg-blue-50/40  ->  bg-info-soft/40
    # Use a back-reference for the /N part.
    # =============================================================
    # NEUTRALS with opacity
    (r"\bbg-(?:slate|gray|zinc|stone)-50/(\d+)",  r"bg-muted/\1"),
    (r"\bbg-(?:slate|gray|zinc|stone)-100/(\d+)", r"bg-muted/\1"),
    (r"\bbg-(?:slate|gray|zinc|stone)-200/(\d+)", r"bg-neutral-200/\1"),
    (r"\bbg-(?:slate|gray|zinc|stone)-700/(\d+)", r"bg-muted/\1"),
    (r"\bbg-(?:slate|gray|zinc|stone)-800/(\d+)", r"bg-muted/\1"),
    (r"\bbg-(?:slate|gray|zinc|stone)-900/(\d+)", r"bg-neutral-900/\1"),  # overlay-ish
    (r"\bhover:bg-(?:slate|gray|zinc|stone)-50/(\d+)",  r"hover:bg-muted/\1"),
    (r"\bhover:bg-(?:slate|gray|zinc|stone)-100/(\d+)", r"hover:bg-muted/\1"),

    # SEMANTIC with opacity
    (r"\bbg-blue-50/(\d+)",     r"bg-info-soft/\1"),
    (r"\bbg-blue-100/(\d+)",    r"bg-info-soft/\1"),
    (r"\bhover:bg-blue-50/(\d+)", r"hover:bg-info-soft/\1"),

    (r"\bbg-(?:red|rose)-50/(\d+)",  r"bg-destructive-soft/\1"),
    (r"\bbg-(?:red|rose)-100/(\d+)", r"bg-destructive-soft/\1"),
    (r"\bbg-(?:red|rose)-400/(\d+)", r"bg-destructive/\1"),
    (r"\bhover:bg-(?:red|rose)-50/(\d+)", r"hover:bg-destructive-soft/\1"),

    (r"\bbg-(?:emerald|green|lime)-50/(\d+)",  r"bg-success-soft/\1"),
    (r"\bbg-(?:emerald|green|lime)-100/(\d+)", r"bg-success-soft/\1"),
    (r"\bhover:bg-(?:emerald|green|lime)-50/(\d+)", r"hover:bg-success-soft/\1"),

    (r"\bbg-(?:amber|yellow|orange)-50/(\d+)",  r"bg-warning-soft/\1"),
    (r"\bbg-(?:amber|yellow|orange)-100/(\d+)", r"bg-warning-soft/\1"),
    (r"\bbg-(?:amber|yellow|orange)-400/(\d+)", r"bg-warning/\1"),
    (r"\bhover:bg-(?:amber|yellow|orange)-50/(\d+)", r"hover:bg-warning-soft/\1"),

    (r"\bbg-(?:purple|pink|fuchsia)-50/(\d+)",  r"bg-chart-7/\1"),
    (r"\bbg-(?:indigo|violet)-50/(\d+)",        r"bg-stage-active/\1"),

    # Border opacity variants (rare but seen)
    (r"\bborder-(?:red|rose)-400/(\d+)",        r"border-destructive/\1"),
    (r"\bborder-(?:amber|yellow|orange)-400/(\d+)", r"border-warning/\1"),

    # =============================================================
    # Inline style={{ color: "#xxx" }} — common gray hex codes -> CSS vars
    # Used in legacy non-Tailwind components.
    # =============================================================
    (r'color:\s*"#666"',         r'color: "hsl(var(--muted-foreground))"'),
    (r'color:\s*"#888"',         r'color: "hsl(var(--muted-foreground))"'),
    (r'color:\s*"#555"',         r'color: "hsl(var(--muted-foreground))"'),
    (r'color:\s*"#777"',         r'color: "hsl(var(--muted-foreground))"'),
    (r'color:\s*"#999"',         r'color: "hsl(var(--muted-foreground))"'),
    (r'color:\s*"#333"',         r'color: "hsl(var(--foreground))"'),
    (r'color:\s*"#444"',         r'color: "hsl(var(--foreground))"'),
    (r'color:\s*"#222"',         r'color: "hsl(var(--foreground))"'),
    (r'color:\s*"#000"',         r'color: "hsl(var(--foreground))"'),
    (r'color:\s*"#a40000"',      r'color: "hsl(var(--destructive))"'),
    (r'color:\s*"#94a3b8"',      r'color: "hsl(var(--neutral-400))"'),
    (r'borderColor:\s*"#f3c4c4"', r'borderColor: "hsl(var(--destructive) / 0.3)"'),
    (r'"1px solid #ececef"',     r'"1px solid hsl(var(--border))"'),
    (r'"1px solid #f4f4f7"',     r'"1px solid hsl(var(--border) / 0.6)"'),
    (r'"1px solid #e5e7eb"',     r'"1px solid hsl(var(--border))"'),
    (r'"#94a3b8"',               r'"hsl(var(--neutral-400))"'),  # generic fallback (chart colors etc.)

    # =============================================================
    # Fix-ups: white-on-light bugs created by the mechanical pass.
    # Patterns where the original was `bg-slate-900 text-white` (dark active
    # state) became `bg-card text-white` after replace -> invisible in light
    # mode. The right token for "active state" is `bg-primary`.
    # =============================================================
    (r"\bbg-card text-white\b",                "bg-primary text-primary-foreground"),
    (r"\bbg-muted text-white\b",               "bg-primary text-primary-foreground"),
    (r"\btext-white bg-card\b",                "bg-primary text-primary-foreground"),
    (r"\btext-white bg-muted\b",               "bg-primary text-primary-foreground"),
    # Hover states that flip dark->light surface: keep dark
    (r"\bhover:bg-muted\b(?=[^\"]*\bbg-neutral-700\b)", "hover:bg-neutral-600"),
    (r"\bhover:bg-card\b(?=[^\"]*\bbg-neutral-700\b)",  "hover:bg-neutral-600"),

    # `bg-white` literal -> `bg-card` so it follows theme (still white in
    # light mode, dark-card in dark mode)
    (r"\bbg-white(?![\d/-])",                  "bg-card"),
    (r"\bhover:bg-white(?![\d/-])",            "hover:bg-card"),

    # =============================================================
    # text-*-900 (dark on light) -> *-soft-foreground tokens
    # =============================================================
    (r"\btext-blue-900(?![\d/])",                "text-info-soft-foreground"),
    (r"\btext-(?:red|rose)-900(?![\d/])",        "text-destructive-soft-foreground"),
    (r"\btext-(?:emerald|green|lime)-900(?![\d/])", "text-success-soft-foreground"),
    (r"\btext-(?:amber|yellow|orange)-900(?![\d/])", "text-warning-soft-foreground"),
    (r"\btext-(?:purple|pink|fuchsia)-900(?![\d/])", "text-chart-7"),
    (r"\btext-(?:indigo|violet)-900(?![\d/])",   "text-stage-active-foreground"),
    (r"\btext-(?:sky|cyan|teal)-900(?![\d/])",   "text-chart-5"),
]


def process_file(path: Path, dry_run: bool) -> tuple[int, list[tuple[str, int]]]:
    """Apply substitutions to one file. Returns (total_changes, [(pattern, count), ...])."""
    text = path.read_text(encoding="utf-8")
    original = text
    per_rule: list[tuple[str, int]] = []
    total = 0
    for pat, repl in SUBS:
        new_text, n = re.subn(pat, repl, text)
        if n:
            per_rule.append((pat, n))
            total += n
            text = new_text
    if total and not dry_run:
        path.write_text(text, encoding="utf-8")
    return (total, per_rule) if original != text else (0, [])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--file", help="Run on a single file path (relative to apps/web/src)")
    args = parser.parse_args()

    if args.file:
        files = [ROOT / args.file]
    else:
        files = [p for p in ROOT.rglob("*.ts")] + [p for p in ROOT.rglob("*.tsx")]
        files = [p for p in files if p.name not in SKIP_NAMES]

    grand_total = 0
    files_changed = 0
    per_file: list[tuple[Path, int]] = []
    for p in files:
        if not p.exists():
            continue
        total, _ = process_file(p, args.dry_run)
        if total:
            files_changed += 1
            grand_total += total
            per_file.append((p, total))

    per_file.sort(key=lambda x: -x[1])
    print(f"\n{'DRY RUN — ' if args.dry_run else ''}Files changed: {files_changed}, total replacements: {grand_total}\n")
    for p, n in per_file[:50]:
        rel = p.relative_to(ROOT)
        print(f"  {n:5d}  {rel}")
    if len(per_file) > 50:
        print(f"  ... and {len(per_file) - 50} more files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
