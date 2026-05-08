import { useEffect, useState } from "react";
import axios from "axios";

interface Props {
  projectId: string;
  onClose: () => void;
}

interface BankAccount {
  id: string;
  purpose: "ESCROW" | "CURRENT";
  accountName: string;
  bankName: string;
  branchAddress: string | null;
  iban: string;
  accountNumber: string;
  refPrefix: string | null;
}

const inp =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-0.5";
const hint = "text-xs text-slate-400 mt-0.5";

const BLANK_ESCROW: BankAccount = {
  id: "",
  purpose: "ESCROW",
  accountName: "",
  bankName: "",
  branchAddress: "",
  iban: "",
  accountNumber: "",
  refPrefix: "",
};
const BLANK_CURRENT: BankAccount = { ...BLANK_ESCROW, purpose: "CURRENT", refPrefix: null };

// Editor for SPA Particulars Items IX (Escrow) and X (Current Account).
// One ESCROW + one CURRENT account per project; refPrefix on the escrow row
// builds the per-unit "Reference: Unit no" (e.g. "SR2-STD-" + "207").
export default function ProjectBankAccountsModal({ projectId, onClose }: Props) {
  const [escrow, setEscrow] = useState<BankAccount>(BLANK_ESCROW);
  const [current, setCurrent] = useState<BankAccount>(BLANK_CURRENT);
  const [loading, setLoading] = useState(true);
  const [savingPurpose, setSavingPurpose] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<BankAccount[]>(`/api/projects/${projectId}/bank-accounts`)
      .then((r) => {
        const e = r.data.find((a) => a.purpose === "ESCROW");
        const c = r.data.find((a) => a.purpose === "CURRENT");
        if (e) setEscrow({ ...e, branchAddress: e.branchAddress ?? "", refPrefix: e.refPrefix ?? "" });
        if (c) setCurrent({ ...c, branchAddress: c.branchAddress ?? "" });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const save = async (account: BankAccount) => {
    setError(null);
    setSaved(null);
    setSavingPurpose(account.purpose);
    try {
      const payload: Partial<BankAccount> = {
        purpose: account.purpose,
        accountName: account.accountName,
        bankName: account.bankName,
        branchAddress: account.branchAddress || null,
        iban: account.iban,
        accountNumber: account.accountNumber,
        refPrefix: account.purpose === "ESCROW" ? (account.refPrefix || null) : null,
      };
      await axios.put(`/api/projects/${projectId}/bank-accounts`, payload);
      setSaved(account.purpose);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save bank account");
    } finally {
      setSavingPurpose(null);
    }
  };

  const renderEditor = (
    account: BankAccount,
    setter: (a: BankAccount) => void,
    title: string,
    showRefPrefix: boolean,
  ) => (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
        {saved === account.purpose && (
          <span className="text-xs text-emerald-600 font-medium">Saved</span>
        )}
      </div>
      <div>
        <label className={lbl}>Account Name *</label>
        <input
          required
          value={account.accountName}
          onChange={(e) => setter({ ...account, accountName: e.target.value })}
          placeholder={account.purpose === "ESCROW" ? "e.g. SAMHA RESIDENCE 2" : "e.g. SAMHA REAL ESTATE DEVELOPMENT LLC"}
          className={inp}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Bank Name *</label>
          <input
            required
            value={account.bankName}
            onChange={(e) => setter({ ...account, bankName: e.target.value })}
            placeholder="e.g. Sharjah Islamic Bank"
            className={inp}
          />
        </div>
        <div>
          <label className={lbl}>Branch Address</label>
          <input
            value={account.branchAddress ?? ""}
            onChange={(e) => setter({ ...account, branchAddress: e.target.value })}
            placeholder="e.g. SHARJAH-Main Branch"
            className={inp}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>IBAN *</label>
          <input
            required
            value={account.iban}
            onChange={(e) => setter({ ...account, iban: e.target.value })}
            placeholder="AE…"
            className={inp}
          />
        </div>
        <div>
          <label className={lbl}>Account Number *</label>
          <input
            required
            value={account.accountNumber}
            onChange={(e) => setter({ ...account, accountNumber: e.target.value })}
            className={inp}
          />
        </div>
      </div>
      {showRefPrefix && (
        <div>
          <label className={lbl}>Per-Unit Reference Prefix</label>
          <input
            value={account.refPrefix ?? ""}
            onChange={(e) => setter({ ...account, refPrefix: e.target.value })}
            placeholder="e.g. SR2-STD-"
            className={inp}
          />
          <p className={hint}>
            Combined with the unit number to build the SPA "Reference: Unit no" line (e.g. SR2-STD-207).
          </p>
        </div>
      )}
      <div className="pt-1">
        <button
          onClick={() => save(account)}
          disabled={savingPurpose === account.purpose}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {savingPurpose === account.purpose ? "Saving…" : `Save ${title}`}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Project Bank Accounts</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Used by SPA Particulars Items IX (Escrow) and X (Current Account)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {renderEditor(escrow, setEscrow, "Escrow Account", true)}
              {renderEditor(current, setCurrent, "Current Account", false)}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <div className="pt-1 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
