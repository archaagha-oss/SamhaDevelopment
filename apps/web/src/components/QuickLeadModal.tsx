import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useAgents } from "../hooks/useAgents";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { Button } from "@/components/ui/button";

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
    <>
      <Modal
        open
        onClose={handleClose}
        title={
          <div>
            <h2 className="font-bold text-foreground text-lg">Quick add lead</h2>
            <p className="text-muted-foreground text-xs mt-0.5">Capture basic info in seconds</p>
          </div>
        }
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button form="quick-lead-form" type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create lead"}
            </Button>
          </>
        }
      >
        <form id="quick-lead-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ql-firstName" className={lbl}>First Name *</label>
              <input
                id="ql-firstName"
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
              <label htmlFor="ql-lastName" className={lbl}>Last Name *</label>
              <input
                id="ql-lastName"
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
            <label htmlFor="ql-phone" className={lbl}>Phone *</label>
            <div className="relative">
              <input
                id="ql-phone"
                required
                type="tel"
                inputMode="tel"
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
            <label htmlFor="ql-agent" className={lbl}>Assigned Sales Agent *</label>
            <select
              id="ql-agent"
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
            <p role="alert" className="text-sm text-destructive bg-destructive-soft border border-destructive/30 px-3 py-2 rounded-lg">{error}</p>
          )}
        </form>
      </Modal>

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
    </>
  );
}
