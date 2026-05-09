import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { dealPartiesApi } from "../services/phase2ApiService";

interface DealParty {
  id: string;
  leadId: string;
  role: "PRIMARY" | "CO_BUYER" | "GUARANTOR";
  ownershipPercentage: number;
  lead: { id: string; firstName: string; lastName: string | null; phone: string };
}
interface Lead {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
}

/**
 * Edit the joint-owner / co-buyer composition of a deal.  Enforces
 * sum-to-100 and exactly-one-PRIMARY on save.
 */
export default function JointOwnerEditor({ dealId }: { dealId: string }) {
  const [parties, setParties] = useState<DealParty[]>([]);
  const [leadOptions, setLeadOptions] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [list, leads] = await Promise.all([
        dealPartiesApi.list(dealId),
        axios.get("/api/leads", { params: { limit: 100 } }).then((r) => r.data.data ?? r.data),
      ]);
      setParties(list);
      setLeadOptions(leads);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dealId]);

  const updateParty = (idx: number, key: "role" | "ownershipPercentage" | "leadId", value: any) => {
    const next = [...parties];
    (next[idx] as any)[key] =
      key === "ownershipPercentage" ? Number(value) : value;
    setParties(next);
  };

  const addParty = () => {
    setParties([
      ...parties,
      {
        id: `new-${Date.now()}`,
        leadId: "",
        role: "CO_BUYER",
        ownershipPercentage: 0,
        lead: { id: "", firstName: "—", lastName: "", phone: "" },
      },
    ]);
  };

  const removeParty = (idx: number) => {
    setParties(parties.filter((_, i) => i !== idx));
  };

  const sum = parties.reduce((a, p) => a + (p.ownershipPercentage || 0), 0);
  const primaries = parties.filter((p) => p.role === "PRIMARY").length;
  const valid = Math.abs(sum - 100) < 0.01 && primaries === 1 && parties.every((p) => p.leadId);

  const save = async () => {
    if (!valid) {
      toast.error(
        `Invalid: ${primaries !== 1 ? `${primaries} primaries · ` : ""}sum=${sum.toFixed(2)}%`,
      );
      return;
    }
    try {
      await dealPartiesApi.replace(
        dealId,
        parties.map((p) => ({
          leadId: p.leadId,
          role: p.role,
          ownershipPercentage: p.ownershipPercentage,
        })),
      );
      toast.success("Parties saved");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  if (loading) return <p className="text-muted-foreground text-sm">Loading parties…</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Buyers & Joint Owners</h4>
        <span
          className={`text-xs ${valid ? "text-success" : "text-destructive"}`}
        >
          Sum: {sum.toFixed(2)}% · {primaries} primary
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-muted-foreground border-b">
            <th className="py-1">Lead</th>
            <th>Role</th>
            <th>Ownership %</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p, idx) => (
            <tr key={p.id} className="border-b">
              <td className="py-1">
                <select
                  className="border rounded px-1 py-0.5 text-sm w-full"
                  value={p.leadId}
                  onChange={(e) => updateParty(idx, "leadId", e.target.value)}
                >
                  <option value="">Select lead…</option>
                  {leadOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName} {l.lastName ?? ""} · {l.phone}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  className="border rounded px-1 py-0.5 text-sm"
                  value={p.role}
                  onChange={(e) => updateParty(idx, "role", e.target.value)}
                >
                  <option>PRIMARY</option>
                  <option>CO_BUYER</option>
                  <option>GUARANTOR</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="border rounded px-1 py-0.5 text-sm w-24"
                  value={p.ownershipPercentage}
                  onChange={(e) => updateParty(idx, "ownershipPercentage", e.target.value)}
                />
              </td>
              <td>
                <button
                  className="text-destructive text-xs hover:underline"
                  onClick={() => removeParty(idx)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button className="text-sm text-primary hover:underline" onClick={addParty}>
          + Add party
        </button>
        <div className="flex-1" />
        <button
          disabled={!valid}
          className="bg-primary disabled:bg-neutral-300 text-white text-sm px-3 py-1 rounded"
          onClick={save}
        >
          Save Parties
        </button>
      </div>
    </div>
  );
}
