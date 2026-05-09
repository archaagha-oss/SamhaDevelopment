import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { escrowApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const SELECT_CLASS =
  "h-9 text-sm border border-input rounded-md px-2.5 bg-background text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface EscrowAccount {
  id: string;
  bankName: string;
  branch: string | null;
  accountName: string;
  accountNo: string;
  iban: string | null;
  currency: string;
  isActive: boolean;
  trusteeAccount?: { trusteeName: string } | null;
}

interface LedgerEntry {
  id: string;
  direction: "CREDIT" | "DEBIT";
  reason: string;
  amount: number;
  currency: string;
  postedAt: string;
  postedBy: string;
  externalRef: string | null;
  notes: string | null;
}

export default function EscrowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [accounts, setAccounts] = useState<EscrowAccount[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ credits: number; debits: number; balance: number } | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [entry, setEntry] = useState<Record<string, string>>({ direction: "CREDIT", reason: "CUSTOMER_PAYMENT" });

  const loadAccounts = async () => {
    if (!projectId) return;
    try {
      const data = await escrowApi.accountsForProject(projectId);
      setAccounts(data);
      if (data.length > 0 && !active) setActive(data[0].id);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const loadAccount = async () => {
    if (!active) return;
    try {
      const [bal, led] = await Promise.all([escrowApi.balance(active), escrowApi.ledger(active)]);
      setBalance(bal);
      setLedger(led);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, [projectId]);
  useEffect(() => {
    void loadAccount();
  }, [active]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    try {
      await escrowApi.postEntry(active, {
        direction: entry.direction,
        reason: entry.reason,
        amount: Number(entry.amount),
        externalRef: entry.externalRef ?? null,
        notes: entry.notes ?? null,
      });
      toast.success("Entry posted");
      setEntry({ direction: "CREDIT", reason: "CUSTOMER_PAYMENT" });
      await loadAccount();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message);
    }
  };

  if (!projectId) return <div className="p-6">Project ID required.</div>;

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[
          { label: "Home", path: "/" },
          { label: "Projects", path: "/projects" },
          { label: "Escrow" },
        ]}
        title="Escrow ledger"
        subtitle="Customer-payment ledger entries per escrow account."
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">

      {accounts.length === 0 ? (
        <p className="text-muted-foreground">No escrow accounts configured for this project.</p>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {accounts.map((a) => (
              <Button
                key={a.id}
                type="button"
                size="sm"
                variant={active === a.id ? "default" : "outline"}
                onClick={() => setActive(a.id)}
              >
                {a.bankName} · {a.accountNo}
              </Button>
            ))}
          </div>

          {balance && (
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded p-4">
                <div className="text-xs uppercase text-muted-foreground">Credits</div>
                <div className="text-2xl font-semibold">AED {balance.credits.toLocaleString()}</div>
              </div>
              <div className="border rounded p-4">
                <div className="text-xs uppercase text-muted-foreground">Debits</div>
                <div className="text-2xl font-semibold">AED {balance.debits.toLocaleString()}</div>
              </div>
              <div className="border rounded p-4 bg-info-soft">
                <div className="text-xs uppercase text-muted-foreground">Balance</div>
                <div className="text-2xl font-semibold">AED {balance.balance.toLocaleString()}</div>
              </div>
            </div>
          )}

          <form className="border border-border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-6 gap-2 bg-muted/50" onSubmit={post}>
            <select
              className={SELECT_CLASS}
              value={entry.direction}
              onChange={(e) => setEntry({ ...entry, direction: e.target.value })}
              aria-label="Direction"
            >
              <option value="CREDIT">CREDIT</option>
              <option value="DEBIT">DEBIT</option>
            </select>
            <select
              className={SELECT_CLASS}
              value={entry.reason}
              onChange={(e) => setEntry({ ...entry, reason: e.target.value })}
              aria-label="Reason"
            >
              {[
                "CUSTOMER_PAYMENT",
                "DEVELOPER_DRAWDOWN",
                "REFUND",
                "BANK_FEE",
                "TRANSFER",
                "OPENING_BALANCE",
                "ADJUSTMENT",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <Input
              className="h-9 text-sm"
              type="number"
              placeholder="Amount"
              value={entry.amount ?? ""}
              onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
            />
            <Input
              className="h-9 text-sm"
              placeholder="Bank ref"
              value={entry.externalRef ?? ""}
              onChange={(e) => setEntry({ ...entry, externalRef: e.target.value })}
            />
            <Input
              className="h-9 text-sm col-span-1"
              placeholder="Notes"
              value={entry.notes ?? ""}
              onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
            />
            <Button type="submit" size="sm">
              Post
            </Button>
          </form>

          <h2 className="font-medium mt-4">Ledger</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-1">Posted</th>
                <th>Direction</th>
                <th>Reason</th>
                <th>Amount</th>
                <th>Ref</th>
                <th>Notes</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-1">{new Date(e.postedAt).toLocaleString()}</td>
                  <td className={e.direction === "CREDIT" ? "text-success" : "text-destructive"}>{e.direction}</td>
                  <td>{e.reason}</td>
                  <td className="text-right">
                    {e.currency} {e.amount.toLocaleString()}
                  </td>
                  <td>{e.externalRef ?? "—"}</td>
                  <td className="max-w-xs truncate">{e.notes ?? ""}</td>
                  <td>{e.postedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
