import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { PageHeader } from "./ui/PageHeader";
import { Button } from "./ui/Button";

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
  agents: BrokerAgent[];
  deals: { id: string }[];
  commissions: { amount: number; status: string }[];
  createdAt: string;
}

const INPUT_CLS = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400";
const LABEL_CLS = "text-xs text-slate-500 mb-1 block font-medium";
const SECTION_CLS = "border-t border-slate-100 pt-4 mt-4";
const SECTION_TITLE_CLS = "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3";

const emptyCompanyForm = () => ({
  name: "", email: "", phone: "", commissionRate: "4",
  reraLicenseNumber: "", reraLicenseExpiry: "", tradeLicenseNumber: "",
  tradeLicenseCopyUrl: "", vatCertificateNo: "", vatCertificateUrl: "",
  corporateTaxCertUrl: "", officeRegistrationNo: "", ornCertificateUrl: "",
  officeManagerBrokerId: "", website: "",
  officeNo: "", buildingName: "", neighborhood: "", emirate: "", postalCode: "",
  bankName: "", bankAccountName: "", bankAccountNo: "", bankIban: "", bankCurrency: "AED",
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
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? "Uploading…" : value ? "Replace" : "Choose File"}
        </button>
        {value ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate max-w-[180px]">
            {filename}
          </a>
        ) : (
          <span className="text-xs text-slate-400">No file selected</span>
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
    if (days < 0) return { label: "Expired", cls: "bg-red-100 text-red-700" };
    if (days <= 60) return { label: `Expires in ${days}d`, cls: "bg-amber-100 text-amber-700" };
    return null;
  };

  const openEditForm = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name,
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

  const filtered = companies.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

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
          <div>
            <label className={LABEL_CLS}>IBAN</label>
            <input placeholder="AE..." value={f.bankIban} onChange={(e) => setF({ ...f, bankIban: e.target.value })} className={INPUT_CLS} />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <PageHeader
        title="Brokers"
        description={`${companies.length} registered compan${companies.length !== 1 ? "ies" : "y"}`}
        actions={
          <>
            <input
              type="search" placeholder="Search company…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border border-slate-200 rounded-ctrl px-3 py-1.5 w-44 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
            />
            <Button onClick={() => setShowForm(true)} leadingIcon={<Plus className="h-4 w-4" />}>
              Add Company
            </Button>
          </>
        }
      />
      <div className="p-6 space-y-5">

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Company list */}
          <div className="lg:col-span-1 space-y-2">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">No companies found</div>
            ) : filtered.map((company) => (
              <button key={company.id} onClick={() => setSelected(company)}
                className={`w-full text-left bg-white rounded-xl border p-4 transition-all hover:border-blue-300 hover:shadow-sm ${selected?.id === company.id ? "border-blue-500 shadow-sm" : "border-slate-200"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-sm">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-400">{company.deals.length} deals</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm mb-1">{company.name}</p>
                {company.email && <p className="text-xs text-slate-400 truncate">{company.email}</p>}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">{company.agents.length} agents</span>
                  <span className="text-xs font-semibold text-emerald-600">AED {getPaidCommission(company).toLocaleString()} paid</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                <p className="text-3xl mb-2 opacity-30">◉</p>
                <p className="text-sm">Select a company to view details</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                      <div className="flex flex-wrap gap-3 mt-0.5">
                        {selected.email && <span className="text-xs text-slate-500">{selected.email}</span>}
                        {selected.phone && <span className="text-xs text-slate-500">{selected.phone}</span>}
                        {selected.commissionRate != null && (
                          <span className="text-xs text-slate-500">Commission: <strong>{selected.commissionRate}%</strong></span>
                        )}
                        {selected.website && (
                          <a href={selected.website} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">{selected.website}</a>
                        )}
                      </div>

                      {/* Licensing summary */}
                      {(selected.reraLicenseNumber || selected.tradeLicenseNumber || selected.officeRegistrationNo || selected.vatCertificateNo) && (
                        <div className="flex flex-wrap gap-3 mt-1">
                          {selected.reraLicenseNumber && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              License: {selected.reraLicenseNumber}
                              {(() => { const w = reraWarning(selected.reraLicenseExpiry); return w ? <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${w.cls}`}>{w.label}</span> : null; })()}
                            </span>
                          )}
                          {selected.tradeLicenseNumber && <span className="text-xs text-slate-500">Trade: {selected.tradeLicenseNumber}</span>}
                          {selected.officeRegistrationNo && <span className="text-xs text-slate-500">ORN: {selected.officeRegistrationNo}</span>}
                          {selected.vatCertificateNo && <span className="text-xs text-slate-500">VAT: {selected.vatCertificateNo}</span>}
                          {selected.officeManagerBrokerId && <span className="text-xs text-slate-500">Broker ID: {selected.officeManagerBrokerId}</span>}
                        </div>
                      )}

                      {/* Location summary */}
                      {(selected.emirate || selected.buildingName || selected.officeNo) && (
                        <p className="text-xs text-slate-400 mt-1">
                          {[selected.officeNo && `Office ${selected.officeNo}`, selected.buildingName, selected.neighborhood, selected.emirate, selected.postalCode].filter(Boolean).join(", ")}
                        </p>
                      )}

                      {/* Bank summary */}
                      {selected.bankName && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {selected.bankName}{selected.bankAccountName && ` — ${selected.bankAccountName}`}{selected.bankIban && ` · IBAN: ${selected.bankIban.slice(0, 8)}…`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {selected.deals.length === 0 && (
                        <button onClick={handleDeleteCompany} className="text-xs px-2.5 py-1 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                          Delete
                        </button>
                      )}
                      <button onClick={openEditForm} className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-1">×</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Agents",     value: selected.agents.length,   color: "text-blue-600" },
                      { label: "Deals",      value: selected.deals.length,    color: "text-indigo-600" },
                      { label: "Commission", value: `AED ${(getTotalCommission(selected)/1000).toFixed(0)}K`, color: "text-emerald-600" },
                    ].map((s) => (
                      <div key={s.label} className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                        <p className="text-xs text-slate-500">{s.label}</p>
                        <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Agents */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">Agents</h3>
                    <button
                      onClick={() => { setShowAgentForm(true); setAgentForm(emptyAgentForm()); }}
                      className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1">
                      <span className="text-sm leading-none">+</span> Add Agent
                    </button>
                  </div>
                  {selected.agents.length === 0 ? (
                    <p className="text-sm text-slate-400">No agents registered</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.agents.map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-xs font-semibold">
                              {agent.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-slate-800">{agent.name}</span>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                {agent.reraCardNumber && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    RERA: {agent.reraCardNumber}
                                    {(() => { const w = reraWarning(agent.reraCardExpiry); return w ? <span className={`px-1 py-0.5 rounded text-xs font-medium ${w.cls}`}>{w.label}</span> : null; })()}
                                  </span>
                                )}
                                {agent.eidNo && <span className="text-xs text-slate-400">EID: {agent.eidNo}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {agent.phone && <span className="text-xs text-slate-400">{agent.phone}</span>}
                            <button
                              onClick={() => handleDeleteAgent(agent.id)}
                              disabled={deletingAgent === agent.id}
                              className="text-slate-300 hover:text-red-500 transition-colors text-sm leading-none disabled:opacity-50"
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
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Commission Breakdown</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Total",   amount: getTotalCommission(selected), color: "text-slate-700" },
                      { label: "Paid",    amount: getPaidCommission(selected),  color: "text-emerald-600" },
                      { label: "Pending", amount: selected.commissions.filter((c) => ["PENDING_APPROVAL","APPROVED"].includes(c.status)).reduce((s,c)=>s+c.amount,0), color: "text-amber-600" },
                      { label: "Not Due", amount: selected.commissions.filter((c) => c.status === "NOT_DUE").reduce((s,c)=>s+c.amount,0), color: "text-slate-400" },
                    ].map((item) => (
                      <div key={item.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <p className="text-xs text-slate-500">{item.label}</p>
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
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="font-bold text-slate-900">New Broker Company</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-0">
              <CompanyFormFields f={form} setF={setForm} />
              <div className="flex gap-3 pt-5">
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit company modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="font-bold text-slate-900">Edit Company</h2>
              <button onClick={() => setShowEditForm(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleEdit} className="px-6 py-5 space-y-0">
              <CompanyFormFields f={editForm} setF={setEditForm} />
              <div className="flex gap-3 pt-5">
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm">Save</button>
                <button type="button" onClick={() => setShowEditForm(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add agent modal */}
      {showAgentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="font-bold text-slate-900">Add Agent</h2>
              <button onClick={() => setShowAgentForm(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
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
                    checked={agentForm.acceptedConsent}
                    onChange={(e) => setAgentForm({ ...agentForm, acceptedConsent: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-sm text-slate-600">
                    I consent to Samha Development contacting me regarding my inquiry.
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-5">
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm">Add Agent</button>
                <button type="button" onClick={() => setShowAgentForm(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteCompany}
        title="Delete Broker Company"
        message="Delete this company? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={doDeleteCompany}
        onCancel={() => setConfirmDeleteCompany(false)}
      />
      <ConfirmDialog
        open={!!confirmDeleteAgentId}
        title="Remove Agent"
        message="Remove this agent from the company?"
        confirmLabel="Remove"
        variant="danger"
        onConfirm={doDeleteAgent}
        onCancel={() => setConfirmDeleteAgentId(null)}
      />
      </div>
    </>
  );
}
