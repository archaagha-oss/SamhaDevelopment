import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { escrowApi } from "../services/phase2ApiService";

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
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Escrow Ledger</h1>

      {accounts.length === 0 ? (
        <p className="text-gray-500">No escrow accounts configured for this project.</p>
      ) : (
        <>
          <div className="flex gap-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                className={`text-sm px-3 py-1 rounded border ${active === a.id ? "bg-blue-600 text-white" : "bg-white"}`}
                onClick={() => setActive(a.id)}
              >
                {a.bankName} · {a.accountNo}
              </button>
            ))}
          </div>

          {balance && (
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded p-4">
                <div className="text-xs uppercase text-gray-500">Credits</div>
                <div className="text-2xl font-semibold">AED {balance.credits.toLocaleString()}</div>
              </div>
              <div className="border rounded p-4">
                <div className="text-xs uppercase text-gray-500">Debits</div>
                <div className="text-2xl font-semibold">AED {balance.debits.toLocaleString()}</div>
              </div>
              <div className="border rounded p-4 bg-blue-50">
                <div className="text-xs uppercase text-gray-500">Balance</div>
                <div className="text-2xl font-semibold">AED {balance.balance.toLocaleString()}</div>
              </div>
            </div>
          )}

          <form className="border rounded p-4 grid grid-cols-6 gap-2 bg-gray-50" onSubmit={post}>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={entry.direction}
              onChange={(e) => setEntry({ ...entry, direction: e.target.value })}
            >
              <option value="CREDIT">CREDIT</option>
              <option value="DEBIT">DEBIT</option>
            </select>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={entry.reason}
              onChange={(e) => setEntry({ ...entry, reason: e.target.value })}
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
            <input
              className="border rounded px-2 py-1 text-sm"
              type="number"
              placeholder="Amount"
              value={entry.amount ?? ""}
              onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Bank ref"
              value={entry.externalRef ?? ""}
              onChange={(e) => setEntry({ ...entry, externalRef: e.target.value })}
            />
            <input
              className="border rounded px-2 py-1 text-sm col-span-1"
              placeholder="Notes"
              value={entry.notes ?? ""}
              onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
            />
            <button className="bg-blue-600 text-white text-sm rounded px-3 py-1" type="submit">
              Post
            </button>
          </form>

          <h2 className="font-medium mt-4">Ledger</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b">
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
                  <td className={e.direction === "CREDIT" ? "text-green-700" : "text-red-700"}>{e.direction}</td>
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
  );
}
