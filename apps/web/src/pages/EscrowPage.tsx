import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { formatDirham } from "@/lib/money";
import { escrowApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";
import ProjectSubTabs from "../components/project/ProjectSubTabs";

interface EscrowAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string | null;
  purpose: string;
}

interface LedgerEntry {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  transactionDate: string;
  reference: string | null;
  notes: string | null;
  createdBy: string;
  dealId: string;
  paymentId: string | null;
}

export default function EscrowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [accounts, setAccounts] = useState<EscrowAccount[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ credits: number; debits: number; balance: number } | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [entry, setEntry] = useState<Record<string, string>>({ type: "CREDIT" });

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

  const loadLedger = async () => {
    if (!projectId) return;
    try {
      const [bal, led] = await Promise.all([escrowApi.balance(projectId), escrowApi.ledger(projectId)]);
      setBalance(bal);
      setLedger(led);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  useEffect(() => {
    void loadAccounts();
    void loadLedger();
  }, [projectId]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    if (!entry.dealId) {
      toast.error("Deal ID is required");
      return;
    }
    if (!entry.amount || Number(entry.amount) <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    try {
      await escrowApi.postEntry({
        dealId: entry.dealId,
        type: entry.type,
        amount: Number(entry.amount),
        transactionDate: entry.transactionDate || new Date().toISOString(),
        reference: entry.reference ?? null,
        notes: entry.notes ?? null,
        bankAccountId: active ?? null,
      });
      toast.success("Entry posted");
      setEntry({ type: "CREDIT" });
      await loadLedger();
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
          { label: "Project", path: `/projects/${projectId}` },
          { label: "Escrow" },
        ]}
        title="Escrow ledger"
        subtitle="Customer-payment ledger entries per escrow account."
      />
      <ProjectSubTabs projectId={projectId} currentKey="escrow" showOverview />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">

      {accounts.length === 0 ? (
        <p className="text-muted-foreground">
          No escrow bank account configured for this project. Configure one in
          Project settings before recording transactions.
        </p>
      ) : (
        <div className="flex gap-2">
          {accounts.map((a) => (
            <button
              key={a.id}
              className={`text-sm px-3 py-1 rounded border ${active === a.id ? "bg-primary text-white" : "bg-card"}`}
              onClick={() => setActive(a.id)}
            >
              {a.bankName} · {a.accountNumber}
            </button>
          ))}
        </div>
      )}

      {balance && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded p-4">
            <div className="text-xs uppercase text-muted-foreground">Credits</div>
            <div className="text-2xl font-semibold">{formatDirham(balance.credits)}</div>
          </div>
          <div className="border rounded p-4">
            <div className="text-xs uppercase text-muted-foreground">Debits</div>
            <div className="text-2xl font-semibold">{formatDirham(balance.debits)}</div>
          </div>
          <div className="border rounded p-4 bg-info-soft">
            <div className="text-xs uppercase text-muted-foreground">Balance</div>
            <div className="text-2xl font-semibold">{formatDirham(balance.balance)}</div>
          </div>
        </div>
      )}

      <form className="border rounded p-4 grid grid-cols-6 gap-2 bg-muted/50" onSubmit={post}>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={entry.type}
          onChange={(e) => setEntry({ ...entry, type: e.target.value })}
        >
          <option value="CREDIT">CREDIT</option>
          <option value="DEBIT">DEBIT</option>
        </select>
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="Deal ID"
          value={entry.dealId ?? ""}
          onChange={(e) => setEntry({ ...entry, dealId: e.target.value })}
        />
        <input
          className="border rounded px-2 py-1 text-sm"
          type="number"
          placeholder="Amount"
          value={entry.amount ?? ""}
          onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
        />
        <input
          className="border rounded px-2 py-1 text-sm"
          type="date"
          value={entry.transactionDate ?? ""}
          onChange={(e) => setEntry({ ...entry, transactionDate: e.target.value })}
        />
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="Reference"
          value={entry.reference ?? ""}
          onChange={(e) => setEntry({ ...entry, reference: e.target.value })}
        />
        <button className="bg-primary text-white text-sm rounded px-3 py-1" type="submit">
          Post
        </button>
        <input
          className="border rounded px-2 py-1 text-sm col-span-6"
          placeholder="Notes"
          value={entry.notes ?? ""}
          onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
        />
      </form>

      <h2 className="font-medium mt-4">Ledger</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-muted-foreground border-b">
            <th className="py-1">Date</th>
            <th>Type</th>
            <th>Deal</th>
            <th>Amount</th>
            <th>Ref</th>
            <th>Notes</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {ledger.map((e) => (
            <tr key={e.id} className="border-b">
              <td className="py-1">{new Date(e.transactionDate).toLocaleDateString()}</td>
              <td className={e.type === "CREDIT" ? "text-success" : "text-destructive"}>{e.type}</td>
              <td className="font-mono text-xs">{e.dealId}</td>
              <td className="text-right">{formatDirham(e.amount)}</td>
              <td>{e.reference ?? "—"}</td>
              <td className="max-w-xs truncate">{e.notes ?? ""}</td>
              <td>{e.createdBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
