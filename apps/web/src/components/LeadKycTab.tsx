import { useEffect, useState } from "react";
import { toast } from "sonner";
import { kycApi } from "../services/phase2ApiService";

interface KYCRecord {
  id: string;
  status: string;
  riskRating: string;
  idType: string | null;
  idNumber: string | null;
  idExpiryDate: string | null;
  visaExpiryDate: string | null;
  nationality: string | null;
  residencyStatus: string | null;
  occupation: string | null;
  pepFlag: boolean;
  sourceOfFunds: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-warning-soft text-warning-soft-foreground",
  IN_REVIEW: "bg-info-soft text-primary",
  APPROVED: "bg-success-soft text-success-soft-foreground",
  EXPIRED: "bg-destructive-soft text-destructive-soft-foreground",
  REJECTED: "bg-destructive-soft text-destructive-soft-foreground",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-success-soft text-success-soft-foreground",
  MEDIUM: "bg-warning-soft text-warning-soft-foreground",
  HIGH: "bg-destructive-soft text-destructive-soft-foreground",
};

export default function LeadKycTab({ leadId }: { leadId: string }) {
  const [records, setRecords] = useState<KYCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    idType: "PASSPORT",
    nationality: "",
    occupation: "",
    pepFlag: false,
    sourceOfFunds: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await kycApi.listForLead(leadId));
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [leadId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await kycApi.create(leadId, form);
      toast.success("KYC record created");
      setShowForm(false);
      setForm({});
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const approve = async (rec: KYCRecord) => {
    try {
      await kycApi.update(rec.id, { status: "APPROVED" });
      toast.success("KYC approved");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h3 className="font-medium">KYC Records</h3>
        <button
          className="text-sm text-primary hover:underline"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? "Cancel" : "+ New KYC"}
        </button>
      </div>

      {showForm && (
        <form className="grid grid-cols-2 gap-2 bg-muted/50 p-3 rounded" onSubmit={submit}>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={form.idType ?? "PASSPORT"}
            onChange={(e) => setForm({ ...form, idType: e.target.value })}
          >
            <option>PASSPORT</option>
            <option>EMIRATES_ID</option>
            <option>OTHER</option>
          </select>
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="ID number"
            value={form.idNumber ?? ""}
            onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            type="date"
            placeholder="ID expiry"
            value={form.idExpiryDate ?? ""}
            onChange={(e) => setForm({ ...form, idExpiryDate: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="Nationality"
            value={form.nationality ?? ""}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="Occupation"
            value={form.occupation ?? ""}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })}
          />
          <select
            className="border rounded px-2 py-1 text-sm"
            value={form.residencyStatus ?? ""}
            onChange={(e) => setForm({ ...form, residencyStatus: e.target.value })}
          >
            <option value="">Residency status</option>
            <option value="CITIZEN">CITIZEN</option>
            <option value="RESIDENT">RESIDENT</option>
            <option value="NON_RESIDENT">NON_RESIDENT</option>
          </select>
          <textarea
            className="border rounded px-2 py-1 text-sm col-span-2"
            placeholder="Source of funds"
            value={form.sourceOfFunds ?? ""}
            onChange={(e) => setForm({ ...form, sourceOfFunds: e.target.value })}
          />
          <label className="flex items-center gap-1 text-sm col-span-2">
            <input
              type="checkbox"
              checked={!!form.pepFlag}
              onChange={(e) => setForm({ ...form, pepFlag: e.target.checked })}
            />
            Politically exposed person (PEP)
          </label>
          <div className="col-span-2 text-right">
            <button className="bg-primary text-white text-sm px-3 py-1 rounded" type="submit">
              Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-muted-foreground text-sm">No KYC records.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground border-b">
              <th className="py-1">Status</th>
              <th>Risk</th>
              <th>ID</th>
              <th>Nationality</th>
              <th>Occupation</th>
              <th>PEP</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                </td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs ${RISK_COLORS[r.riskRating]}`}>{r.riskRating}</span>
                </td>
                <td>
                  {r.idType ?? "—"} {r.idNumber ? `· ${r.idNumber}` : ""}
                </td>
                <td>{r.nationality ?? "—"}</td>
                <td>{r.occupation ?? "—"}</td>
                <td>{r.pepFlag ? "Yes" : "No"}</td>
                <td>{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}</td>
                <td>
                  {r.status !== "APPROVED" && (
                    <button className="text-primary hover:underline text-xs" onClick={() => approve(r)}>
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
