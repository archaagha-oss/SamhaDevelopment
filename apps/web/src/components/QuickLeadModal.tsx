import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useAgents } from "../hooks/useAgents";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card transition-colors";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

export default function QuickLeadModal({ onClose, onCreated }: Props) {
  const firstNameRef = useRef<HTMLInputElement>(null);
  const { data: agents = [] } = useAgents();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => { firstNameRef.current?.focus(); }, []);

  const handleClose = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Consent is required before creating a lead.");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post("/api/leads", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        assignedAgentId: assignedAgentId || undefined,
        source: "DIRECT",
        consent,
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
      <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-lg">Quick Add Lead</h2>
            <p className="text-muted-foreground text-xs mt-0.5">Capture basic info in seconds</p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
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
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">UAE format</span>
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

          {/* Consent */}
          <label className="flex items-start gap-2.5 cursor-pointer border border-border rounded-xl p-3 bg-muted/50">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => { setConsent(e.target.checked); setDirty(true); }}
              className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              The lead has consented to being contacted about properties. <span className="text-destructive">*</span>
            </span>
          </label>

          {error && (
            <p className="text-sm text-destructive bg-destructive-soft border border-destructive/30 px-3 py-2 rounded-lg">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            form="quick-lead-form"
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Lead"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this new lead?"
        message="Anything you've typed will be lost. Continue creating the lead to save it."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
