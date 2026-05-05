import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useAgents } from "../hooks/useAgents";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";

export default function QuickLeadModal({ onClose, onCreated }: Props) {
  const firstNameRef = useRef<HTMLInputElement>(null);
  const { data: agents = [] } = useAgents();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { firstNameRef.current?.focus(); }, []);

  const handleClose = () => {
    if (dirty && !window.confirm("Discard this new lead?")) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await axios.post("/api/leads", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        assignedAgentId: assignedAgentId || undefined,
        source: "DIRECT",
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Quick Add Lead</h2>
            <p className="text-slate-400 text-xs mt-0.5">Capture basic info in seconds</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <form id="quick-lead-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>First Name *</label>
              <input
                ref={firstNameRef}
                required
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setDirty(true);
                }}
                className={inp}
                placeholder="Ahmed"
              />
            </div>
            <div>
              <label className={lbl}>Last Name *</label>
              <input
                required
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setDirty(true);
                }}
                className={inp}
                placeholder="Al Mansouri"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className={lbl}>Phone *</label>
            <div className="relative">
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setDirty(true);
                }}
                className={inp + " pr-24"}
                placeholder="+971 50 000 0000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">UAE format</span>
            </div>
          </div>

          {/* Assigned agent */}
          <div>
            <label className={lbl}>Assigned Sales Agent *</label>
            <select
              required
              value={assignedAgentId}
              onChange={(e) => {
                setAssignedAgentId(e.target.value);
                setDirty(true);
              }}
              className={inp}
            >
              <option value="">Select agent…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            form="quick-lead-form"
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
