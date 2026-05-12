import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ShieldCheck, IdCard, FileText, Download, Trash2, Pencil, Check, X, AlertTriangle } from "lucide-react";
import DocumentUploadModal from "./DocumentUploadModal";
import type { Document, DocumentType } from "../types";

/**
 * KYC tab for a Lead. Two sections:
 *
 *  1. KYC Profile card — per-person AML data (DOB, occupation, residency,
 *     PEP, risk rating, nationality, source of funds). Lives directly on
 *     the Lead row; edited inline via PATCH /api/leads/:id.
 *
 *  2. KYC Documents list — lead-attached Documents of type
 *     EMIRATES_ID / PASSPORT / VISA. Per-doc metadata (documentNumber,
 *     issueDate, issuingCountry) stored in Document.dataSnapshot. Expiry
 *     dates feed the compliance radar — see complianceService.ts.
 */

const KYC_TYPES: DocumentType[] = ["EMIRATES_ID", "PASSPORT", "VISA"];

const TYPE_LABELS: Record<string, string> = {
  EMIRATES_ID: "Emirates ID",
  PASSPORT:    "Passport",
  VISA:        "Visa",
};

type Severity = "EXPIRED" | "CRITICAL" | "WARNING" | "ATTENTION" | "OK";

function severityFor(daysToExpiry: number | null): Severity | null {
  if (daysToExpiry === null) return null;
  if (daysToExpiry < 0)   return "EXPIRED";
  if (daysToExpiry <= 14) return "CRITICAL";
  if (daysToExpiry <= 30) return "WARNING";
  if (daysToExpiry <= 90) return "ATTENTION";
  return "OK";
}

const SEVERITY_STYLES: Record<Severity, string> = {
  EXPIRED:   "bg-destructive-soft text-destructive",
  CRITICAL:  "bg-destructive-soft text-destructive",
  WARNING:   "bg-warning-soft text-warning",
  ATTENTION: "bg-info-soft text-primary",
  OK:        "bg-success-soft text-success",
};

const RISK_STYLES: Record<string, string> = {
  LOW:    "bg-success-soft text-success",
  MEDIUM: "bg-warning-soft text-warning",
  HIGH:   "bg-destructive-soft text-destructive",
};

function daysBetween(date: Date, from: Date): number {
  return Math.ceil((date.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

interface LeadKyc {
  id: string;
  nationality?: string | null;
  sourceOfFunds?: string | null;
  dateOfBirth?: string | null;
  pepFlag?: boolean;
  riskRating?: "LOW" | "MEDIUM" | "HIGH" | null;
  occupation?: string | null;
  residencyStatus?: "CITIZEN" | "RESIDENT" | "NON_RESIDENT" | null;
}

interface Props {
  leadId: string;
  lead: LeadKyc;
  onLeadUpdated?: (patch: Partial<LeadKyc>) => void;
  onCountChange?: (n: number) => void;
}

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

export default function LeadKycTab({ leadId, lead, onLeadUpdated, onCountChange }: Props) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<LeadKyc>(lead);

  // Re-sync local profile when parent's lead changes.
  useEffect(() => { setProfile(lead); }, [lead]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`/api/documents/lead/${leadId}`);
      const all: Document[] = r.data?.data ?? [];
      const kyc = all.filter((d) => KYC_TYPES.includes(d.type as DocumentType));
      setDocs(kyc);
      onCountChange?.(kyc.length);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        nationality:     profile.nationality     || null,
        sourceOfFunds:   profile.sourceOfFunds   || null,
        dateOfBirth:     profile.dateOfBirth     || null,
        pepFlag:         !!profile.pepFlag,
        riskRating:      profile.riskRating      || null,
        occupation:      profile.occupation      || null,
        residencyStatus: profile.residencyStatus || null,
      };
      await axios.patch(`/api/leads/${leadId}`, payload);
      onLeadUpdated?.(payload as Partial<LeadKyc>);
      toast.success("KYC profile updated");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const r = await axios.get(`/api/documents/${id}/download`);
      const url = r.data?.url ?? r.data?.downloadUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to fetch download URL");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this KYC document?")) return;
    try {
      await axios.delete(`/api/documents/${id}`);
      toast.success("Document deleted");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to delete");
    }
  };

  const profileRows: Array<[string, React.ReactNode]> = editing
    ? [] // edit form is rendered separately below
    : [
        ["Nationality",     profile.nationality || "—"],
        ["Date of birth",   profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : "—"],
        ["Occupation",      profile.occupation || "—"],
        ["Residency",       profile.residencyStatus ? profile.residencyStatus.replace(/_/g, " ") : "—"],
        ["Source of funds", profile.sourceOfFunds || "—"],
      ];

  return (
    <div className="space-y-4">
      {/* ── KYC Profile card ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <IdCard className="size-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-sm">KYC Profile</h3>
            {profile.pepFlag && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-destructive-soft text-destructive inline-flex items-center gap-1">
                <AlertTriangle className="size-3" /> PEP
              </span>
            )}
            {profile.riskRating && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${RISK_STYLES[profile.riskRating]}`}>
                {profile.riskRating} risk
              </span>
            )}
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setEditing(false); setProfile(lead); }}
                disabled={saving}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg"
              >
                <X className="size-3.5" /> Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="size-3.5" /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        <div className="p-4">
          {!editing ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {profileRows.map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground text-right truncate ml-2">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Nationality</label>
                <input className={inp} placeholder="e.g. AE" value={profile.nationality ?? ""}
                  onChange={(e) => setProfile({ ...profile, nationality: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>Date of birth</label>
                <input type="date" className={inp}
                  value={profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : ""}
                  onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>Occupation</label>
                <input className={inp} placeholder="e.g. Software Engineer" value={profile.occupation ?? ""}
                  onChange={(e) => setProfile({ ...profile, occupation: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>Residency status</label>
                <select className={inp} value={profile.residencyStatus ?? ""}
                  onChange={(e) => setProfile({ ...profile, residencyStatus: (e.target.value || null) as any })}>
                  <option value="">—</option>
                  <option value="CITIZEN">Citizen</option>
                  <option value="RESIDENT">Resident</option>
                  <option value="NON_RESIDENT">Non-resident</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Risk rating</label>
                <select className={inp} value={profile.riskRating ?? ""}
                  onChange={(e) => setProfile({ ...profile, riskRating: (e.target.value || null) as any })}>
                  <option value="">—</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" className="w-4 h-4 rounded"
                    checked={!!profile.pepFlag}
                    onChange={(e) => setProfile({ ...profile, pepFlag: e.target.checked })} />
                  Politically exposed person (PEP)
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Source of funds</label>
                <textarea rows={2} className={`${inp} resize-none`}
                  placeholder="Salary, business income, investments, …"
                  value={profile.sourceOfFunds ?? ""}
                  onChange={(e) => setProfile({ ...profile, sourceOfFunds: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KYC Documents ────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-sm">KYC Documents</h3>
            <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">
              {docs.length}
            </span>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90"
          >
            + Upload KYC
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              <IdCard className="size-8 mx-auto mb-2 text-muted-foreground/60" />
              <p>No KYC documents yet.</p>
              <button
                onClick={() => setShowUpload(true)}
                className="text-xs text-primary hover:underline mt-1 font-medium"
              >
                Upload Emirates ID, passport, or visa →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border -mx-1">
              {docs.map((d) => {
                const expiry = d.expiryDate ? new Date(d.expiryDate) : null;
                const days = expiry ? daysBetween(expiry, new Date()) : null;
                const sev = severityFor(days);
                const meta = ((d as any).dataSnapshot ?? null) as
                  | { documentNumber?: string; issueDate?: string; issuingCountry?: string }
                  | null;
                return (
                  <div key={d.id} className="px-1 py-3 flex items-start gap-3">
                    <FileText className="size-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-muted text-muted-foreground">
                          {TYPE_LABELS[d.type] ?? d.type}
                        </span>
                        {sev && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SEVERITY_STYLES[sev]}`}>
                            {sev === "EXPIRED"
                              ? `Expired ${Math.abs(days!)}d ago`
                              : sev === "OK"
                              ? `Valid · ${days}d left`
                              : `${sev} · ${days}d left`}
                          </span>
                        )}
                        {!sev && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
                            No expiry set
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate mt-1">{d.name}</p>
                      {meta && (meta.documentNumber || meta.issueDate || meta.issuingCountry) && (
                        <p className="text-xs text-muted-foreground">
                          {meta.documentNumber ? `№ ${meta.documentNumber}` : ""}
                          {meta.documentNumber && (meta.issueDate || meta.issuingCountry) ? " · " : ""}
                          {meta.issueDate ? `issued ${new Date(meta.issueDate).toLocaleDateString()}` : ""}
                          {meta.issueDate && meta.issuingCountry ? " · " : ""}
                          {meta.issuingCountry ? `${meta.issuingCountry}` : ""}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Uploaded {new Date(d.createdAt).toLocaleDateString()}
                        {expiry ? ` · expires ${expiry.toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleDownload(d.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                        aria-label="Download" title="Download">
                        <Download className="size-4" />
                      </button>
                      <button onClick={() => handleDelete(d.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive-soft rounded-md"
                        aria-label="Delete" title="Delete">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <DocumentUploadModal
          leadId={leadId}
          title="Upload KYC Document"
          allowedTypes={KYC_TYPES}
          defaultType="EMIRATES_ID"
          showExpiry
          onClose={() => setShowUpload(false)}
          onSaved={async () => {
            setShowUpload(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
