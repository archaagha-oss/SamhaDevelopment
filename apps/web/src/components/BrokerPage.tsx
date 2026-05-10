import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Building2, Users } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import InlineDialog from "./InlineDialog";
import { getBrokerStatusColor } from "../utils/statusColors";
import { PageContainer, PageHeader } from "./layout";
import { Button } from "@/components/ui/button";

const BROKER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PENDING_APPROVAL: "Pending Approval",
};

const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

interface BrokerAgent {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  reraCardNumber?: string;
  reraCardExpiry?: string;
  eidNo?: string;
  eidExpiry?: string;
  eidFrontUrl?: string;
  eidBackUrl?: string;
  acceptedConsent?: boolean;
}

interface BrokerCompany {
  id: string;
  name: string;
  status?: "ACTIVE" | "INACTIVE" | "PENDING_APPROVAL";
  email?: string;
  phone?: string;
  commissionRate?: number;
  reraLicenseNumber?: string;
  reraLicenseExpiry?: string;
  tradeLicenseNumber?: string;
  tradeLicenseCopyUrl?: string;
  vatCertificateNo?: string;
  vatCertificateUrl?: string;
  corporateTaxCertUrl?: string;
  officeRegistrationNo?: string;
  ornCertificateUrl?: string;
  officeManagerBrokerId?: string;
  website?: string;
  officeNo?: string;
  buildingName?: string;
  neighborhood?: string;
  emirate?: string;
  postalCode?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankIban?: string;
  bankCurrency?: string;
  bankSwiftCode?: string;
  agents: BrokerAgent[];
  deals: { id: string }[];
  commissions: { amount: number; status: string }[];
  createdAt: string;
}

const INPUT_CLS = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring";
const LABEL_CLS = "text-xs text-muted-foreground mb-1 block font-medium";
const SECTION_CLS = "border-t border-border pt-4 mt-4";
const SECTION_TITLE_CLS = "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3";

const emptyCompanyForm = () => ({
  name: "", email: "", phone: "", commissionRate: "4", status: "PENDING_APPROVAL",
  reraLicenseNumber: "", reraLicenseExpiry: "", tradeLicenseNumber: "",
  tradeLicenseCopyUrl: "", vatCertificateNo: "", vatCertificateUrl: "",
  corporateTaxCertUrl: "", officeRegistrationNo: "", ornCertificateUrl: "",
  officeManagerBrokerId: "", website: "",
  officeNo: "", buildingName: "", neighborhood: "", emirate: "", postalCode: "",
  bankName: "", bankAccountName: "", bankAccountNo: "", bankIban: "", bankCurrency: "AED",
  bankSwiftCode: "",
});

const emptyAgentForm = () => ({
  firstName: "", lastName: "", email: "", phone: "",
  reraCardNumber: "", reraCardExpiry: "",
  eidNo: "", eidExpiry: "", eidFrontUrl: "", eidBackUrl: "",
  acceptedConsent: false,
});

// Inline file upload field
function FileUploadField({
  label, value, onChange, accept = "image/jpeg,image/png,application/pdf",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await axios.post("/api/brokers/upload", fd);
      onChange(data.url);
      toast.success("File uploaded");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const filename = value ? value.split("/").pop()?.split("?")[0] || "Uploaded" : "";

  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 text-xs border border-border rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? "Uploading…" : value ? "Replace" : "Choose File"}
        </button>
        {value ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-[180px]">
            {filename}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">No file selected</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}

export default function BrokerPage() {
  const [companies, setCompanies] = useState<BrokerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BrokerCompany | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyCompanyForm());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentForm, setAgentForm] = useState(emptyAgentForm());

  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState(emptyCompanyForm());

  const [deletingAgent, setDeletingAgent] = useState<string | null>(null);
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState(false);
  const [confirmDeleteAgentId, setConfirmDeleteAgentId] = useState<string | null>(null);

  const fetchCompanies = () => {
    setLoading(true);
    axios.get("/api/brokers/companies")
      .then((r) => setCompanies(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(fetchCompanies, []);

  const refreshAndReselect = async () => {
    const r = await axios.get("/api/brokers/companies");
    setCompanies(r.data);
    if (selected) {
      const updated = r.data.find((c: BrokerCompany) => c.id === selected.id);
      if (updated) setSelected(updated);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post("/api/brokers/companies", {
        ...form,
        commissionRate: parseFloat(form.commissionRate) || 4,
        reraLicenseExpiry: form.reraLicenseExpiry ? new Date(form.reraLicenseExpiry).toISOString() : undefined,
      });
      setForm(emptyCompanyForm());
      setShowForm(false);
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create company");
    }
  };

  const reraWarning = (expiry?: string) => {
    if (!expiry) return null;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: "Expired", cls: "bg-destructive-soft text-destructive" };
    if (days <= 60) return { label: `Expires in ${days}d`, cls: "bg-warning-soft text-warning" };
    return null;
  };

  const openEditForm = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name,
      status: selected.status ?? "PENDING_APPROVAL",
      email: selected.email ?? "",
      phone: selected.phone ?? "",
      commissionRate: String(selected.commissionRate ?? 4),
      reraLicenseNumber: selected.reraLicenseNumber ?? "",
      reraLicenseExpiry: selected.reraLicenseExpiry ? selected.reraLicenseExpiry.slice(0, 10) : "",
      tradeLicenseNumber: selected.tradeLicenseNumber ?? "",
      tradeLicenseCopyUrl: selected.tradeLicenseCopyUrl ?? "",
      vatCertificateNo: selected.vatCertificateNo ?? "",
      vatCertificateUrl: selected.vatCertificateUrl ?? "",
      corporateTaxCertUrl: selected.corporateTaxCertUrl ?? "",
      officeRegistrationNo: selected.officeRegistrationNo ?? "",
      ornCertificateUrl: selected.ornCertificateUrl ?? "",
      officeManagerBrokerId: selected.officeManagerBrokerId ?? "",
      website: selected.website ?? "",
      officeNo: selected.officeNo ?? "",
      buildingName: selected.buildingName ?? "",
      neighborhood: selected.neighborhood ?? "",
      emirate: selected.emirate ?? "",
      postalCode: selected.postalCode ?? "",
      bankName: selected.bankName ?? "",
      bankAccountName: selected.bankAccountName ?? "",
      bankAccountNo: selected.bankAccountNo ?? "",
      bankIban: selected.bankIban ?? "",
      bankCurrency: selected.bankCurrency ?? "AED",
      bankSwiftCode: (selected as any).bankSwiftCode ?? "",
    });
    setShowEditForm(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await axios.patch(`/api/brokers/companies/${selected.id}`, {
        ...editForm,
        commissionRate: parseFloat(editForm.commissionRate) || 4,
        reraLicenseExpiry: editForm.reraLicenseExpiry ? new Date(editForm.reraLicenseExpiry).toISOString() : undefined,
      });
      setShowEditForm(false);
      await refreshAndReselect();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update company");
    }
  };

  const handleDeleteCompany = () => { if (selected) setConfirmDeleteCompany(true); };

  const doDeleteCompany = async () => {
    if (!selected) return;
    setConfirmDeleteCompany(false);
    try {
      await axios.delete(`/api/brokers/companies/${selected.id}`);
      setSelected(null);
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete company");
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!agentForm.acceptedConsent) {
      toast.error("Consent is required before adding an agent.");
      return;
    }
    if (!agentForm.eidFrontUrl || !agentForm.eidBackUrl) {
      toast.error("EID front and back must both be uploaded.");
      return;
    }
    try {
      await axios.post("/api/brokers/agents", {
        companyId: selected.id,
        ...agentForm,
        reraCardExpiry: agentForm.reraCardExpiry ? new Date(agentForm.reraCardExpiry).toISOString() : undefined,
        eidExpiry: agentForm.eidExpiry ? new Date(agentForm.eidExpiry).toISOString() : undefined,
      });
      setAgentForm(emptyAgentForm());
      setShowAgentForm(false);
      await refreshAndReselect();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add agent");
    }
  };

  const handleDeleteAgent = (agentId: string) => setConfirmDeleteAgentId(agentId);

  const doDeleteAgent = async () => {
    const agentId = confirmDeleteAgentId;
    if (!agentId) return;
    setConfirmDeleteAgentId(null);
    setDeletingAgent(agentId);
    try {
      await axios.delete(`/api/brokers/agents/${agentId}`);
      await refreshAndReselect();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to remove agent");
    } finally {
      setDeletingAgent(null);
    }
  };

  const getTotalCommission = (c: BrokerCompany) => c.commissions.reduce((s, x) => s + x.amount, 0);
  const getPaidCommission  = (c: BrokerCompany) => c.commissions.filter((x) => x.status === "PAID").reduce((s, x) => s + x.amount, 0);

  const filtered = companies.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "ALL" && (c.status || "PENDING_APPROVAL") !== statusFilter) return false;
    return true;
  });

  // Shared company form fields (used in both create and edit)
  const CompanyFormFields = ({
    f, setF,
  }: { f: typeof form; setF: (v: typeof form) => void }) => (
    <>
      {/* Basic */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLS}>Company Name *</label>
          <input required placeholder="Company Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>Status</label>
          <select value={f.status || "PENDING_APPROVAL"} onChange={(e) => setF({ ...f, status: e.target.value })} className={INPUT_CLS}>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Commission Rate (%)</label>
          <input type="number" step="0.1" min="0" max="20" placeholder="4" value={f.commissionRate}
            onChange={(e) => setF({ ...f, commissionRate: e.target.value })} className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>Email</label>
          <input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>Phone</label>
          <input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={INPUT_CLS} />
        </div>
      </div>

      {/* Licensing */}
      <div className={SECTION_CLS}>
        <p className={SECTION_TITLE_CLS}>Licensing</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>License No</label>
              <input placeholder="License No" value={f.reraLicenseNumber} onChange={(e) => setF({ ...f, reraLicenseNumber: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>License Expiry Date</label>
              <input type="date" value={f.reraLicenseExpiry} onChange={(e) => setF({ ...f, reraLicenseExpiry: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Trade License No</label>
              <input placeholder="Trade License No" value={f.tradeLicenseNumber} onChange={(e) => setF({ ...f, tradeLicenseNumber: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Office Registration No (ORN)</label>
              <input placeholder="ORN" value={f.officeRegistrationNo} onChange={(e) => setF({ ...f, officeRegistrationNo: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
          <FileUploadField label="Trade License Copy" value={f.tradeLicenseCopyUrl} onChange={(url) => setF({ ...f, tradeLicenseCopyUrl: url })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>VAT Certificate No</label>
              <input placeholder="VAT Certificate No" value={f.vatCertificateNo} onChange={(e) => setF({ ...f, vatCertificateNo: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Office Manager Broker ID No</label>
              <input placeholder="Broker ID" value={f.officeManagerBrokerId} onChange={(e) => setF({ ...f, officeManagerBrokerId: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
          <FileUploadField label="VAT Certificate / Non-VAT Declaration" value={f.vatCertificateUrl} onChange={(url) => setF({ ...f, vatCertificateUrl: url })} />
          <FileUploadField label="Corporate Tax Certificate" value={f.corporateTaxCertUrl} onChange={(url) => setF({ ...f, corporateTaxCertUrl: url })} />
          <FileUploadField label="ORN Certificate" value={f.ornCertificateUrl} onChange={(url) => setF({ ...f, ornCertificateUrl: url })} />
          <div>
            <label className={LABEL_CLS}>Company Website</label>
            <input type="url" placeholder="https://..." value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className={INPUT_CLS} />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className={SECTION_CLS}>
        <p className={SECTION_TITLE_CLS}>Location</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Office No</label>
              <input placeholder="Office No" value={f.officeNo} onChange={(e) => setF({ ...f, officeNo: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Building Name</label>
              <input placeholder="Building Name" value={f.buildingName} onChange={(e) => setF({ ...f, buildingName: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLS}>Neighborhood</label>
            <input placeholder="Neighborhood" value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} className={INPUT_CLS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Emirate</label>
              <select value={f.emirate} onChange={(e) => setF({ ...f, emirate: e.target.value })} className={INPUT_CLS}>
                <option value="">Select Emirate</option>
                {EMIRATES.map((em) => <option key={em} value={em}>{em}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Postal Code</label>
              <input placeholder="Postal Code" value={f.postalCode} onChange={(e) => setF({ ...f, postalCode: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
        </div>
      </div>

      {/* Banking */}
      <div className={SECTION_CLS}>
        <p className={SECTION_TITLE_CLS}>Bank Details</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Bank Name</label>
              <input placeholder="Bank Name" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Account Name</label>
              <input placeholder="Account Name" value={f.bankAccountName} onChange={(e) => setF({ ...f, bankAccountName: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Account No</label>
              <input placeholder="Account No" value={f.bankAccountNo} onChange={(e) => setF({ ...f, bankAccountNo: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Currency</label>
              <input placeholder="AED" value={f.bankCurrency} onChange={(e) => setF({ ...f, bankCurrency: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>IBAN</label>
              <input placeholder="AE..." value={f.bankIban} onChange={(e) => setF({ ...f, bankIban: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>SWIFT Code</label>
              <input placeholder="e.g. ADIBAEAA" value={f.bankSwiftCode} onChange={(e) => setF({ ...f, bankSwiftCode: e.target.value })} className={INPUT_CLS} />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Brokers" }]}
        title="Brokers"
        subtitle={`${companies.length} registered companies`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/broker-onboarding">Onboard new broker</a>
            </Button>
            <Button onClick={() => setShowForm(true)}>Add company</Button>
          </>
        }
      />

      <PageContainer padding="default" className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text" placeholder="Search company…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 w-60 focus:outline-none focus:border-ring bg-card"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card focus:outline-none focus:border-ring"
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Company list */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">Broker Companies</h3>
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Building2 className="size-10 text-muted-foreground" aria-hidden="true" />}
                title={search ? "No companies match your search" : "No broker companies yet"}
                description={search ? "Try a different keyword." : "Add your first broker company to start managing agents."}
                action={!search ? { label: "Create broker", onClick: () => setShowForm(true) } : undefined}
              />
            ) : filtered.map((company) => {
              const location = [company.neighborhood, company.emirate].filter(Boolean).join(", ");
              return (
              <button key={company.id} onClick={() => setSelected(company)}
                className={`w-full text-left bg-card rounded-xl border p-4 transition-all hover:border-primary/40 hover:shadow-sm ${selected?.id === company.id ? "border-primary/40 shadow-sm" : "border-border"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 bg-info-soft rounded-lg flex items-center justify-center text-primary font-bold text-sm">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-muted-foreground">{company.deals.length} deals</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground text-sm">{company.name}</p>
                  {(() => {
                    const s = company.status || "PENDING_APPROVAL";
                    const c = getBrokerStatusColor(s);
                    return (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${c.badge}`}>
                        {BROKER_STATUS_LABELS[s]}
                      </span>
                    );
                  })()}
                </div>
                {company.email && <p className="text-xs text-muted-foreground truncate">{company.email}</p>}
                {location && <p className="text-[11px] text-muted-foreground truncate mt-0.5">📍 {location}</p>}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">{company.agents.length} agents</span>
                  <span className="text-xs font-semibold text-success">AED {getPaidCommission(company).toLocaleString()} paid</span>
                </div>
              </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
                <Building2 className="size-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                <p className="text-sm">Select a company to view details</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-border bg-muted/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-foreground">{selected.name}</h2>
                        {(() => {
                          const s = selected.status || "PENDING_APPROVAL";
                          const c = getBrokerStatusColor(s);
                          return (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.badge}`}>
                              {BROKER_STATUS_LABELS[s]}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-0.5">
                        {selected.email && <span className="text-xs text-muted-foreground">{selected.email}</span>}
                        {selected.phone && <span className="text-xs text-muted-foreground">{selected.phone}</span>}
                        {selected.commissionRate != null && (
                          <span className="text-xs text-muted-foreground">Commission: <strong>{selected.commissionRate}%</strong></span>
                        )}
                        {selected.website && (
                          <a href={selected.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{selected.website}</a>
                        )}
                      </div>

                      {/* Licensing summary */}
                      {(selected.reraLicenseNumber || selected.tradeLicenseNumber || selected.officeRegistrationNo || selected.vatCertificateNo) && (
                        <div className="flex flex-wrap gap-3 mt-1">
                          {selected.reraLicenseNumber && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              License: {selected.reraLicenseNumber}
                              {(() => { const w = reraWarning(selected.reraLicenseExpiry); return w ? <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${w.cls}`}>{w.label}</span> : null; })()}
                            </span>
                          )}
                          {selected.tradeLicenseNumber && <span className="text-xs text-muted-foreground">Trade: {selected.tradeLicenseNumber}</span>}
                          {selected.officeRegistrationNo && <span className="text-xs text-muted-foreground">ORN: {selected.officeRegistrationNo}</span>}
                          {selected.vatCertificateNo && <span className="text-xs text-muted-foreground">VAT: {selected.vatCertificateNo}</span>}
                          {selected.officeManagerBrokerId && <span className="text-xs text-muted-foreground">Broker ID: {selected.officeManagerBrokerId}</span>}
                        </div>
                      )}

                      {/* Location summary */}
                      {(selected.emirate || selected.buildingName || selected.officeNo) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {[selected.officeNo && `Office ${selected.officeNo}`, selected.buildingName, selected.neighborhood, selected.emirate, selected.postalCode].filter(Boolean).join(", ")}
                        </p>
                      )}

                      {/* Bank summary */}
                      {selected.bankName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selected.bankName}{selected.bankAccountName && ` — ${selected.bankAccountName}`}{selected.bankIban && ` · IBAN: ${selected.bankIban.slice(0, 8)}…`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {selected.deals.length === 0 && (
                        <button onClick={handleDeleteCompany} className="text-xs px-2.5 py-1 border border-destructive/30 rounded-lg text-destructive hover:bg-destructive-soft transition-colors">
                          Delete
                        </button>
                      )}
                      <button onClick={openEditForm} className="text-xs px-2.5 py-1 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none ml-1">×</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Agents",     value: selected.agents.length,   color: "text-primary" },
                      { label: "Deals",      value: selected.deals.length,    color: "text-accent-2" },
                      { label: "Commission", value: `AED ${(getTotalCommission(selected)/1000).toFixed(0)}K`, color: "text-success" },
                    ].map((s) => (
                      <div key={s.label} className="bg-card rounded-lg p-3 border border-border text-center">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Agents */}
                <div className="px-6 py-4 border-b border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Agents</h3>
                    <button
                      onClick={() => { setShowAgentForm(true); setAgentForm(emptyAgentForm()); }}
                      className="text-xs px-2.5 py-1 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-1">
                      <span className="text-sm leading-none">+</span> Add Agent
                    </button>
                  </div>
                  {selected.agents.length === 0 ? (
                    <EmptyState
                      icon={<Users className="size-10 text-muted-foreground" aria-hidden="true" />}
                      title="No agents registered"
                      description="Add agents to this company so deals can be linked to a broker contact."
                      action={{ label: "Create agent", onClick: () => { setShowAgentForm(true); setAgentForm(emptyAgentForm()); } }}
                    />
                  ) : (
                    <div className="space-y-2">
                      {selected.agents.map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border border-border">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-neutral-200 rounded-full flex items-center justify-center text-muted-foreground text-xs font-semibold">
                              {agent.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-foreground">{agent.name}</span>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                {agent.reraCardNumber && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    RERA: {agent.reraCardNumber}
                                    {(() => { const w = reraWarning(agent.reraCardExpiry); return w ? <span className={`px-1 py-0.5 rounded text-xs font-medium ${w.cls}`}>{w.label}</span> : null; })()}
                                  </span>
                                )}
                                {agent.eidNo && <span className="text-xs text-muted-foreground">EID: {agent.eidNo}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {agent.phone && <span className="text-xs text-muted-foreground">{agent.phone}</span>}
                            <button
                              onClick={() => handleDeleteAgent(agent.id)}
                              disabled={deletingAgent === agent.id}
                              className="text-foreground/80 hover:text-destructive transition-colors text-sm leading-none disabled:opacity-50"
                              title="Remove agent">
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Commission breakdown */}
                <div className="px-6 py-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Commission Breakdown</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Total",   amount: getTotalCommission(selected), color: "text-foreground" },
                      { label: "Paid",    amount: getPaidCommission(selected),  color: "text-success" },
                      { label: "Pending", amount: selected.commissions.filter((c) => ["PENDING_APPROVAL","APPROVED"].includes(c.status)).reduce((s,c)=>s+c.amount,0), color: "text-warning" },
                      { label: "Not Due", amount: selected.commissions.filter((c) => c.status === "NOT_DUE").reduce((s,c)=>s+c.amount,0), color: "text-muted-foreground" },
                    ].map((item) => (
                      <div key={item.label} className="bg-muted/50 rounded-lg p-3 border border-border">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className={`font-bold ${item.color}`}>AED {item.amount.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create company modal */}
      <InlineDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        ariaLabel="Create broker"
        overlayClassName="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      >
        <div className="bg-card rounded-2xl w-full max-w-2xl shadow-2xl my-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
            <h2 className="font-bold text-foreground">Create broker</h2>
            <button onClick={() => setShowForm(false)} aria-label="Close dialog" className="text-muted-foreground hover:text-foreground text-xl leading-none p-1 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">×</button>
          </div>
          <form onSubmit={handleCreate} className="px-6 py-5 space-y-0">
            <CompanyFormFields f={form} setF={setForm} />
            <div className="flex gap-3 pt-5">
              <button type="submit" className="flex-1 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 text-sm">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">Cancel</button>
            </div>
          </form>
        </div>
      </InlineDialog>

      {/* Edit company modal */}
      <InlineDialog
        open={showEditForm}
        onClose={() => setShowEditForm(false)}
        ariaLabel="Edit broker"
        overlayClassName="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      >
        <div className="bg-card rounded-2xl w-full max-w-2xl shadow-2xl my-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
            <h2 className="font-bold text-foreground">Edit broker</h2>
            <button onClick={() => setShowEditForm(false)} aria-label="Close dialog" className="text-muted-foreground hover:text-foreground text-xl leading-none p-1 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">×</button>
          </div>
          <form onSubmit={handleEdit} className="px-6 py-5 space-y-0">
            <CompanyFormFields f={editForm} setF={setEditForm} />
            <div className="flex gap-3 pt-5">
              <button type="submit" className="flex-1 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 text-sm">Save changes</button>
              <button type="button" onClick={() => setShowEditForm(false)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">Cancel</button>
            </div>
          </form>
        </div>
      </InlineDialog>

      {/* Add agent modal */}
      <InlineDialog
        open={showAgentForm}
        onClose={() => setShowAgentForm(false)}
        ariaLabel="Add agent"
        overlayClassName="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      >
        <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
              <h2 className="font-bold text-foreground">Add Agent</h2>
              <button onClick={() => setShowAgentForm(false)} aria-label="Close dialog" className="text-muted-foreground hover:text-foreground text-xl leading-none p-1 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">×</button>
            </div>
            <form onSubmit={handleAddAgent} className="px-6 py-5">
              {/* Identity */}
              <p className={SECTION_TITLE_CLS}>Identity</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>First Name</label>
                    <input placeholder="First Name" value={agentForm.firstName} onChange={(e) => setAgentForm({ ...agentForm, firstName: e.target.value })} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Last Name</label>
                    <input placeholder="Last Name" value={agentForm.lastName} onChange={(e) => setAgentForm({ ...agentForm, lastName: e.target.value })} className={INPUT_CLS} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>EID No</label>
                    <input placeholder="EID No" value={agentForm.eidNo} onChange={(e) => setAgentForm({ ...agentForm, eidNo: e.target.value })} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>EID Expiry</label>
                    <input type="date" value={agentForm.eidExpiry} onChange={(e) => setAgentForm({ ...agentForm, eidExpiry: e.target.value })} className={INPUT_CLS} />
                  </div>
                </div>
                <FileUploadField label="EID Front" value={agentForm.eidFrontUrl} onChange={(url) => setAgentForm({ ...agentForm, eidFrontUrl: url })} accept="image/jpeg,image/png,application/pdf" />
                <FileUploadField label="EID Back" value={agentForm.eidBackUrl} onChange={(url) => setAgentForm({ ...agentForm, eidBackUrl: url })} accept="image/jpeg,image/png,application/pdf" />
              </div>

              {/* Contact */}
              <div className={SECTION_CLS}>
                <p className={SECTION_TITLE_CLS}>Contact</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>Phone</label>
                      <input placeholder="Phone" value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Email</label>
                      <input type="email" placeholder="Email" value={agentForm.email} onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })} className={INPUT_CLS} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>RERA Card #</label>
                      <input placeholder="RERA Card #" value={agentForm.reraCardNumber} onChange={(e) => setAgentForm({ ...agentForm, reraCardNumber: e.target.value })} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>RERA Card Expiry</label>
                      <input type="date" value={agentForm.reraCardExpiry} onChange={(e) => setAgentForm({ ...agentForm, reraCardExpiry: e.target.value })} className={INPUT_CLS} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Consent */}
              <div className={SECTION_CLS}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={agentForm.acceptedConsent}
                    onChange={(e) => setAgentForm({ ...agentForm, acceptedConsent: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded border-border text-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    I consent to Samha Development contacting me regarding my inquiry. <span className="text-destructive">*</span>
                  </span>
                </label>
                {(!agentForm.eidFrontUrl || !agentForm.eidBackUrl) && (
                  <p className="text-[11px] text-warning mt-2">EID front and back uploads are required to add an agent.</p>
                )}
              </div>

              <div className="flex gap-3 pt-5">
                <button
                  type="submit"
                  disabled={!agentForm.acceptedConsent || !agentForm.eidFrontUrl || !agentForm.eidBackUrl}
                  className="flex-1 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >Add Agent</button>
                <button type="button" onClick={() => setShowAgentForm(false)} className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm">Cancel</button>
              </div>
            </form>
        </div>
      </InlineDialog>

      <ConfirmDialog
        open={confirmDeleteCompany}
        title="Delete broker"
        message="Delete this company? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={doDeleteCompany}
        onCancel={() => setConfirmDeleteCompany(false)}
      />
      <ConfirmDialog
        open={!!confirmDeleteAgentId}
        title="Remove agent"
        message="Remove this agent from the company?"
        confirmLabel="Remove"
        variant="danger"
        onConfirm={doDeleteAgent}
        onCancel={() => setConfirmDeleteAgentId(null)}
      />
      </PageContainer>
    </div>
  );
}
