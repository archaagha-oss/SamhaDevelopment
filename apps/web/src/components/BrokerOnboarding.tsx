import { useState, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Check, CheckCircle2 } from "lucide-react";

interface CompanyForm {
  name: string;
  email: string;
  phone: string;
  website?: string;
  commissionRate: string;
  reraLicenseNumber: string;
  reraLicenseExpiry: string;
  tradeLicenseNumber: string;
  tradeLicenseCopyUrl: string;
  vatCertificateNo: string;
  vatCertificateUrl: string;
  corporateTaxCertUrl: string;
  ornCertificateUrl: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNo: string;
  bankIban: string;
  bankCurrency: string;
}

interface AgentForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  reraCardNumber: string;
  reraCardExpiry: string;
  eidNo: string;
  eidExpiry: string;
  acceptedConsent: boolean;
}

const emptyCompanyForm = (): CompanyForm => ({
  name: "", email: "", phone: "", website: "", commissionRate: "4",
  reraLicenseNumber: "", reraLicenseExpiry: "",
  tradeLicenseNumber: "", tradeLicenseCopyUrl: "",
  vatCertificateNo: "", vatCertificateUrl: "",
  corporateTaxCertUrl: "", ornCertificateUrl: "",
  bankName: "", bankAccountName: "", bankAccountNo: "", bankIban: "", bankCurrency: "AED",
});

const emptyAgentForm = (): AgentForm => ({
  firstName: "", lastName: "", email: "", phone: "",
  reraCardNumber: "", reraCardExpiry: "",
  eidNo: "", eidExpiry: "", acceptedConsent: false,
});

const INPUT_CLS = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring";
const LABEL_CLS = "text-xs text-muted-foreground mb-1 block font-medium";

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

  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        {value ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-success" /> Uploaded
          </span>
        ) : uploading ? "Uploading…" : "Choose File"}
      </button>
    </div>
  );
}

export default function BrokerOnboarding() {
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState<CompanyForm>(emptyCompanyForm());
  const [agent, setAgent] = useState<AgentForm>(emptyAgentForm());
  const [agents, setAgents] = useState<AgentForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const handleCompanyChange = (field: keyof CompanyForm, value: any) => {
    setCompany((prev) => ({ ...prev, [field]: value }));
  };

  const handleAgentChange = (field: keyof AgentForm, value: any) => {
    setAgent((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddAgent = () => {
    if (!agent.firstName || !agent.lastName || !agent.email || !agent.phone) {
      toast.error("Please fill in all required agent fields");
      return;
    }
    setAgents((prev) => [...prev, agent]);
    setAgent(emptyAgentForm());
  };

  const handleRemoveAgent = (idx: number) => {
    setAgents((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitCompany = async () => {
    if (!company.name || !company.email || !company.phone || !company.reraLicenseNumber) {
      toast.error("Please fill in all required company fields");
      return;
    }

    setSaving(true);
    try {
      const { data } = await axios.post("/api/brokers/companies", company);
      setCompanyId(data.id);
      toast.success("Company registered successfully");
      setStep(2);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to register company");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAgents = async () => {
    if (agents.length === 0) {
      toast.error("Please add at least one agent");
      return;
    }

    setSaving(true);
    try {
      for (const a of agents) {
        await axios.post("/api/brokers/agents", {
          ...a,
          companyId,
          name: `${a.firstName} ${a.lastName}`,
        });
      }
      toast.success("All agents registered successfully");
      setStep(3);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to register agents");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = () => {
    toast.success("Broker onboarding completed!");
    window.location.href = "/brokers";
  };

  return (
    <div className="min-h-screen bg-muted/50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Broker Onboarding</h1>
          <p className="text-muted-foreground mt-2">Complete registration in 3 steps</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 flex gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s
                    ? "bg-primary text-white"
                    : "bg-neutral-200 text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="size-4" /> : s}
              </div>
              <span className={`text-sm font-medium ${step >= s ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 && "Company"}
                {s === 2 && "Agents"}
                {s === 3 && "Complete"}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Company Info */}
        {step === 1 && (
          <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-foreground mb-6">Company Details</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className={LABEL_CLS}>Company Name *</label>
                <input
                  type="text"
                  value={company.name}
                  onChange={(e) => handleCompanyChange("name", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="e.g., Elite Real Estate"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Email *</label>
                <input
                  type="email"
                  value={company.email}
                  onChange={(e) => handleCompanyChange("email", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="company@email.com"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Phone *</label>
                <input
                  type="tel"
                  value={company.phone}
                  onChange={(e) => handleCompanyChange("phone", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="+971 50 123 4567"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Website</label>
                <input
                  type="url"
                  value={company.website || ""}
                  onChange={(e) => handleCompanyChange("website", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="https://company.com"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Commission Rate (%) *</label>
                <input
                  type="number"
                  value={company.commissionRate}
                  onChange={(e) => handleCompanyChange("commissionRate", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="4"
                  min="0"
                  max="10"
                />
              </div>
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-4 mt-8">Compliance Documents</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className={LABEL_CLS}>RERA License Number *</label>
                <input
                  type="text"
                  value={company.reraLicenseNumber}
                  onChange={(e) => handleCompanyChange("reraLicenseNumber", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="RERA-2024-123456"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>RERA License Expiry *</label>
                <input
                  type="date"
                  value={company.reraLicenseExpiry}
                  onChange={(e) => handleCompanyChange("reraLicenseExpiry", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Trade License Number</label>
                <input
                  type="text"
                  value={company.tradeLicenseNumber}
                  onChange={(e) => handleCompanyChange("tradeLicenseNumber", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Trade-2024-789"
                />
              </div>
              <FileUploadField
                label="Trade License Copy"
                value={company.tradeLicenseCopyUrl}
                onChange={(url) => handleCompanyChange("tradeLicenseCopyUrl", url)}
              />
              <div>
                <label className={LABEL_CLS}>VAT Certificate Number</label>
                <input
                  type="text"
                  value={company.vatCertificateNo}
                  onChange={(e) => handleCompanyChange("vatCertificateNo", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="VAT-123456"
                />
              </div>
              <FileUploadField
                label="VAT Certificate"
                value={company.vatCertificateUrl}
                onChange={(url) => handleCompanyChange("vatCertificateUrl", url)}
              />
              <FileUploadField
                label="Corporate Tax Certificate"
                value={company.corporateTaxCertUrl}
                onChange={(url) => handleCompanyChange("corporateTaxCertUrl", url)}
              />
              <FileUploadField
                label="ORN Certificate"
                value={company.ornCertificateUrl}
                onChange={(url) => handleCompanyChange("ornCertificateUrl", url)}
              />
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-4 mt-8">Bank Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Bank Name</label>
                <input
                  type="text"
                  value={company.bankName}
                  onChange={(e) => handleCompanyChange("bankName", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="e.g., Emirates NBD"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Account Name</label>
                <input
                  type="text"
                  value={company.bankAccountName}
                  onChange={(e) => handleCompanyChange("bankAccountName", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Company Name"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Account Number</label>
                <input
                  type="text"
                  value={company.bankAccountNo}
                  onChange={(e) => handleCompanyChange("bankAccountNo", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="1234567890"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>IBAN</label>
                <input
                  type="text"
                  value={company.bankIban}
                  onChange={(e) => handleCompanyChange("bankIban", e.target.value)}
                  className={INPUT_CLS}
                  placeholder="AE070331234567890123456"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={handleSubmitCompany}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:bg-neutral-300 transition-colors"
              >
                {saving ? "Saving…" : "Continue to Agents"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Agents */}
        {step === 2 && (
          <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-foreground mb-6">Register Agents</h2>

            {/* Add Agent Form */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-4">Add Agent</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={LABEL_CLS}>First Name *</label>
                  <input
                    type="text"
                    value={agent.firstName}
                    onChange={(e) => handleAgentChange("firstName", e.target.value)}
                    className={INPUT_CLS}
                    placeholder="Ahmed"
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Last Name *</label>
                  <input
                    type="text"
                    value={agent.lastName}
                    onChange={(e) => handleAgentChange("lastName", e.target.value)}
                    className={INPUT_CLS}
                    placeholder="Al Mansouri"
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Email *</label>
                  <input
                    type="email"
                    value={agent.email}
                    onChange={(e) => handleAgentChange("email", e.target.value)}
                    className={INPUT_CLS}
                    placeholder="agent@company.com"
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Phone *</label>
                  <input
                    type="tel"
                    value={agent.phone}
                    onChange={(e) => handleAgentChange("phone", e.target.value)}
                    className={INPUT_CLS}
                    placeholder="+971 50 123 4567"
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>RERA Card Number</label>
                  <input
                    type="text"
                    value={agent.reraCardNumber}
                    onChange={(e) => handleAgentChange("reraCardNumber", e.target.value)}
                    className={INPUT_CLS}
                    placeholder="RERA-AGENT-2024-123"
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>RERA Card Expiry</label>
                  <input
                    type="date"
                    value={agent.reraCardExpiry}
                    onChange={(e) => handleAgentChange("reraCardExpiry", e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>EID Number</label>
                  <input
                    type="text"
                    value={agent.eidNo}
                    onChange={(e) => handleAgentChange("eidNo", e.target.value)}
                    className={INPUT_CLS}
                    placeholder="784-1994-1234567-8"
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>EID Expiry</label>
                  <input
                    type="date"
                    value={agent.eidExpiry}
                    onChange={(e) => handleAgentChange("eidExpiry", e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={agent.acceptedConsent}
                  onChange={(e) => handleAgentChange("acceptedConsent", e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-xs text-muted-foreground">I accept the terms and conditions</span>
              </label>
              <button
                onClick={handleAddAgent}
                className="w-full px-4 py-2 bg-info-soft text-primary font-medium rounded-lg hover:bg-info/30 transition-colors"
              >
                + Add Agent
              </button>
            </div>

            {/* Added Agents List */}
            {agents.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">Registered Agents ({agents.length})</h3>
                <div className="space-y-2">
                  {agents.map((a, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded border border-border">
                      <div>
                        <p className="font-medium text-foreground">{a.firstName} {a.lastName}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveAgent(idx)}
                        className="px-3 py-1 text-destructive hover:bg-destructive-soft rounded transition-colors text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-4 py-2 border border-border text-foreground font-medium rounded-lg hover:bg-muted/50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmitAgents}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:bg-neutral-300 transition-colors"
              >
                {saving ? "Saving…" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div className="bg-card rounded-xl border border-border p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-success-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="size-8 text-success" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Onboarding Complete!</h2>
            <p className="text-muted-foreground mb-8">Your broker company and agents have been successfully registered.</p>

            <div className="bg-muted/50 rounded-lg p-4 mb-8 text-left">
              <h3 className="font-semibold text-foreground mb-2">What's Next?</h3>
              <ul className="text-sm text-foreground space-y-1">
                <li className="flex items-start gap-2"><Check className="size-4 text-success mt-0.5 shrink-0" /> Company and {agents.length} agent(s) registered</li>
                <li className="flex items-start gap-2"><Check className="size-4 text-success mt-0.5 shrink-0" /> RERA and compliance documents stored</li>
                <li className="flex items-start gap-2"><Check className="size-4 text-success mt-0.5 shrink-0" /> Bank details configured for commission payouts</li>
                <li>→ Start assigning agents to leads</li>
                <li>→ Monitor commission approvals in dashboard</li>
              </ul>
            </div>

            <button
              onClick={handleComplete}
              className="w-full px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to Broker Management
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
