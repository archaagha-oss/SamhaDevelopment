import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src"

SUBS = [
    (r'\bbg-stage-active text-chart-4(?![\d-])',     'bg-stage-active text-stage-active-foreground'),
    (r'\btext-chart-4 bg-stage-active(?![\d-])',     'bg-stage-active text-stage-active-foreground'),
    (r'\bborder-chart-4/(\d+)\b',                    r'border-accent-2/\1'),
    (r'\bbg-chart-4 hover:bg-chart-4(?![\d/-])',     'bg-accent-2 hover:bg-accent-2/90'),
    (r'\bbg-chart-4 text-white(?![\d-])',            'bg-accent-2 text-accent-2-foreground'),
    (r'\bbg-chart-4(?![\d/-])',                      'bg-accent-2'),
    (r'\btext-chart-4(?![\d-])',                     'text-accent-2'),
]

SKIP = {"ReportsPage.tsx", "ExecutiveDashboard.tsx", "stage-badge.tsx"}

changed = 0
for p in list(ROOT.rglob("*.ts")) + list(ROOT.rglob("*.tsx")):
    if p.name in SKIP:
        continue
    text = p.read_text(encoding="utf-8")
    orig = text
    for pat, repl in SUBS:
        text = re.sub(pat, repl, text)
    if text != orig:
        p.write_text(text, encoding="utf-8")
        changed += 1
        print(f"  {p.relative_to(ROOT)}")

print(f"\n{changed} files updated.")
