import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useSettings, type AppSettings } from "../contexts/SettingsContext";

type Tab = "company" | "localization" | "communication" | "finance" | "templates";

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const sel = inp;

const TIMEZONES = [
  "Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC",
];
const CURRENCIES = ["AED", "SAR", "USD", "EUR", "GBP", "QAR", "KWD", "BHD", "OMR"];
const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (e.g. 30/04/2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (e.g. 04/30/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (e.g. 2026-04-30)" },
];

type EmailTemplates = AppSettings["emailTemplates"];

interface Form {
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  defaultFromName: string;
  defaultFromEmail: string;
  whatsappNumber: string;
  smsProvider: string;
  emailProvider: string;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;            // empty = no edit; non-empty = replace
  smtpPasswordSet: boolean;        // server-reported flag
  paymentInstructions: string;
  emailTemplates: EmailTemplates;
}

function fromSettings(s: AppSettings): Form {
  return {
    companyName:         s.companyName ?? "",
    logoUrl:             s.logoUrl ?? "",
    primaryColor:        s.primaryColor ?? "#2563eb",
    timezone:            s.timezone,
    currency:            s.currency,
    dateFormat:          s.dateFormat,
    defaultFromName:     s.defaultFromName ?? "",
    defaultFromEmail:    s.defaultFromEmail ?? "",
    whatsappNumber:      s.whatsappNumber ?? "",
    smsProvider:         s.smsProvider ?? "",
    emailProvider:       s.emailProvider ?? "",
    smtpHost:            s.smtpHost ?? "",
    smtpPort:            s.smtpPort != null ? String(s.smtpPort) : "",
    smtpUsername:        s.smtpUsername ?? "",
    smtpPassword:        "",
    smtpPasswordSet:     s.smtpPasswordSet,
    paymentInstructions: s.paymentInstructions ?? "",
    emailTemplates:      s.emailTemplates ?? {},
  };
}

export default function SettingsPage() {
  const { settings, isLoading, refresh } = useSettings();
  const [tab, setTab] = useState<Tab>("company");
  const [form, setForm] = useState<Form>(() => fromSettings(settings));
  const [saving, setSaving] = useState<string | null>(null); // section being saved

  useEffect(() => { setForm(fromSettings(settings)); }, [settings]);

  const set = <K extends keyof Form>(key: K, val: Form[K]) => setForm((f) => ({ ...f, [key]: val }));

  async function save(section: Tab, body: Record<string, unknown>) {
    setSaving(section);
    try {
      await axios.patch(`/api/settings/${apiSection[section]}`, body);
      await refresh();
      toast.success(`${labels[section]} saved`);
    } catch (e: any) {
      const details = e.response?.data?.details;
      toast.error(details?.[0] ?? e.response?.data?.error ?? "Save failed");
    } finally {
      setSaving(null);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "company",       label: "Company Profile" },
    { key: "localization",  label: "Localization" },
    { key: "communication", label: "Communication" },
    { key: "finance",       label: "Finance" },
    { key: "templates",     label: "Email Templates" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">App Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">Organization-level configuration and communication setup</p>
        </div>
        <div className="max-w-3xl mx-auto px-6 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {tab === "company"       && <CompanySection       form={form} set={set} saving={saving === "company"}       onSave={() => save("company", { companyName: form.companyName, logoUrl: form.logoUrl, primaryColor: form.primaryColor })} />}
        {tab === "localization"  && <LocalizationSection  form={form} set={set} saving={saving === "localization"}  onSave={() => save("localization", { timezone: form.timezone, currency: form.currency, dateFormat: form.dateFormat })} />}
        {tab === "communication" && <CommunicationSection form={form} set={set} saving={saving === "communication"} onSave={() => save("communication", communicationBody(form))} />}
        {tab === "finance"       && <FinanceSection       form={form} set={set} saving={saving === "finance"}       onSave={() => save("finance", { paymentInstructions: form.paymentInstructions })} />}
        {tab === "templates"     && <TemplatesSection     form={form} set={set} saving={saving === "templates"}     onSave={() => save("templates", { emailTemplates: form.emailTemplates })} />}
      </div>
    </div>
  );
}

const apiSection: Record<Tab, string> = {
  company: "branding",
  localization: "localization",
  communication: "communication",
  finance: "finance",
  templates: "templates",
};

const labels: Record<Tab, string> = {
  company: "Company profile",
  localization: "Localization",
  communication: "Communication",
  finance: "Finance",
  templates: "Email templates",
};

function communicationBody(f: Form) {
  const body: Record<string, unknown> = {
    defaultFromName:  f.defaultFromName,
    defaultFromEmail: f.defaultFromEmail,
    emailProvider:    f.emailProvider,
    whatsappNumber:   f.whatsappNumber,
    smsProvider:      f.smsProvider,
    smtpHost:         f.smtpHost,
    smtpUsername:     f.smtpUsername,
  };
  body.smtpPort = f.smtpPort === "" ? "" : Number(f.smtpPort);
  // Only send smtpPassword if user typed something. Empty = no edit.
  if (f.smtpPassword.length > 0) body.smtpPassword = f.smtpPassword;
  return body;
}

// ─── Section components ────────────────────────────────────────────────────

interface SectionProps {
  form: Form;
  set: <K extends keyof Form>(key: K, val: Form[K]) => void;
  saving: boolean;
  onSave: () => void;
}

function SaveBar({ saving, onSave, label = "Save section" }: { saving: boolean; onSave: () => void; label?: string }) {
  return (
    <div className="flex justify-end pt-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}

function CompanySection({ form, set, saving, onSave }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company Profile</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={lbl}>Company Name</label>
            <input className={inp} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="e.g. Samha Development" />
          </div>
          <div>
            <label className={lbl}>Logo URL</label>
            <input className={inp} value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className={lbl}>Brand Color (hex)</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : "#2563eb"}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="h-10 w-12 rounded border border-slate-200 cursor-pointer"
              />
              <input className={inp} value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} placeholder="#2563eb" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Drives sidebar accents and the app theme variable.</p>
          </div>
        </div>
      </div>
      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

function LocalizationSection({ form, set, saving, onSave }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Localization</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Timezone</label>
            <select className={sel} value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Currency</label>
            <select className={sel} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Date Format</label>
            <select className={sel} value={form.dateFormat} onChange={(e) => set("dateFormat", e.target.value)}>
              {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">Applied app-wide to amounts and dates after saving.</p>
      </div>
      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

function CommunicationSection({ form, set, saving, onSave }: SectionProps) {
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  async function testSmtp() {
    if (!testTo) { toast.error("Enter a destination email"); return; }
    setTesting(true);
    try {
      await axios.post("/api/settings/test-smtp", { to: testTo });
      toast.success(`Test email queued to ${testTo}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email Sender</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>From Name</label>
            <input className={inp} value={form.defaultFromName} onChange={(e) => set("defaultFromName", e.target.value)} placeholder="e.g. Samha Sales Team" />
          </div>
          <div>
            <label className={lbl}>From Email</label>
            <input type="email" className={inp} value={form.defaultFromEmail} onChange={(e) => set("defaultFromEmail", e.target.value)} placeholder="sales@samha.ae" />
          </div>
          <div>
            <label className={lbl}>Email Provider</label>
            <select className={sel} value={form.emailProvider} onChange={(e) => set("emailProvider", e.target.value)}>
              <option value="">Not configured</option>
              <option value="sendgrid">SendGrid</option>
              <option value="smtp">SMTP</option>
              <option value="mailgun">Mailgun</option>
              <option value="ses">Amazon SES</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SMTP Delivery</p>
        <p className="text-xs text-slate-400">Used when Email Provider is set to SMTP.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>SMTP Host</label>
            <input className={inp} value={form.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className={lbl}>SMTP Port</label>
            <input type="number" className={inp} value={form.smtpPort} onChange={(e) => set("smtpPort", e.target.value)} placeholder="587" />
          </div>
          <div>
            <label className={lbl}>Username</label>
            <input className={inp} value={form.smtpUsername} onChange={(e) => set("smtpUsername", e.target.value)} placeholder="your@email.com" />
          </div>
          <div>
            <label className={lbl}>
              Password
              <span className={`ml-2 text-[10px] font-normal ${form.smtpPasswordSet ? "text-emerald-600" : "text-slate-400"}`}>
                {form.smtpPasswordSet ? "● set" : "not set"}
              </span>
            </label>
            <input
              type="password"
              className={inp}
              value={form.smtpPassword}
              onChange={(e) => set("smtpPassword", e.target.value)}
              placeholder={form.smtpPasswordSet ? "•••••••• (leave blank to keep)" : "Enter password"}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex gap-2 items-center pt-1">
          <input
            type="email"
            className={inp + " flex-1"}
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Send test email to…"
          />
          <button
            onClick={testSmtp}
            disabled={testing}
            className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50"
          >
            {testing ? "Sending…" : "Test SMTP"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">WhatsApp & SMS</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>WhatsApp Number</label>
            <input className={inp} value={form.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} placeholder="+971501234567" />
          </div>
          <div>
            <label className={lbl}>SMS Provider</label>
            <select className={sel} value={form.smsProvider} onChange={(e) => set("smsProvider", e.target.value)}>
              <option value="">Not configured</option>
              <option value="twilio">Twilio</option>
              <option value="unifonic">Unifonic</option>
              <option value="stc">STC Pay</option>
            </select>
          </div>
        </div>
      </div>

      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

function FinanceSection({ form, set, saving, onSave }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Payment Instructions</p>
          <p className="text-xs text-slate-400 mb-3">Auto-injected into invoices and reminder emails. Include bank name, account name, IBAN, and Swift code.</p>
          <textarea
            className={inp + " resize-y min-h-[140px]"}
            value={form.paymentInstructions}
            onChange={(e) => set("paymentInstructions", e.target.value)}
            placeholder={`Bank Name: Emirates NBD\nAccount Name: Samha Development LLC\nIBAN: AE123456789012345678\nSwift Code: EBILAEAD`}
          />
        </div>
      </div>

      <PermissionsMatrix />
      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

function PermissionsMatrix() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Role Permissions Reference</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
              {["Admin", "Manager", "Agent", "Finance"].map((r) => (
                <th key={r} className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[
              ["Create Deal",       true,  true,  true,  false],
              ["Reserve Unit",      true,  true,  true,  false],
              ["Record Payment",    true,  false, false, true ],
              ["Generate Receipt",  true,  false, false, true ],
              ["Manage Settings",   true,  false, false, false],
              ["View Reports",      true,  true,  false, true ],
            ].map(([action, ...perms]) => (
              <tr key={String(action)}>
                <td className="py-2.5 pr-4 text-sm text-slate-700">{action}</td>
                {perms.map((allowed, i) => (
                  <td key={i} className="py-2.5 px-3 text-center">
                    <span className={allowed ? "text-emerald-600 font-bold" : "text-slate-300"}>
                      {allowed ? "✓" : "–"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">Roles are managed per user in the Team section. Settings PATCH endpoints enforce ADMIN role server-side.</p>
    </div>
  );
}

function TemplatesSection({ form, set, saving, onSave }: SectionProps) {
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; text: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  async function loadPreview(key: "beforeDue" | "onDue" | "overdue7" | "overdue30") {
    setPreviewing(true);
    setPreviewKey(key);
    try {
      // Persist current edits before previewing so the preview reflects them.
      await axios.patch("/api/settings/templates", { emailTemplates: form.emailTemplates });
      const r = await axios.post("/api/settings/templates/preview", { key });
      setPreview(r.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  const templates = useMemo(() => ([
    { key: "beforeDue" as const, label: "7 Days Before Due",     desc: "Friendly reminder — sent 7 days before the due date" },
    { key: "onDue"     as const, label: "Payment Due Today",      desc: "Urgent reminder — sent on the due date" },
    { key: "overdue7"  as const, label: "7 Days Overdue",         desc: "Overdue notice — sent 7 days after the due date" },
    { key: "overdue30" as const, label: "30 Days Overdue (Final)",desc: "Final notice — sent 30 days after the due date" },
  ]), []);

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
        <p className="font-semibold mb-1">Template Variables</p>
        <p>Use: <code className="bg-amber-100 px-1 rounded">{"{{BuyerName}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{UnitNumber}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{Amount}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{DueDate}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{ProjectName}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{Milestone}}"}</code></p>
      </div>
      {templates.map(({ key, label, desc }) => (
        <div key={key} className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
            <button
              onClick={() => loadPreview(key)}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
              disabled={previewing && previewKey === key}
            >
              {previewing && previewKey === key ? "Loading…" : "Preview"}
            </button>
          </div>
          <textarea
            className={inp + " resize-y min-h-[100px] font-mono text-xs"}
            value={form.emailTemplates[key] ?? ""}
            onChange={(e) =>
              set("emailTemplates", { ...form.emailTemplates, [key]: e.target.value })
            }
            placeholder={`Dear {{BuyerName}},\n\nYour payment of {{Amount}} for {{Milestone}} is due on {{DueDate}}.\n\nThank you.`}
          />
          {previewKey === key && preview && (
            <div className="mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Preview</p>
              <p className="text-xs font-bold text-slate-800 mb-2">{preview.subject}</p>
              <pre className="whitespace-pre-wrap text-xs text-slate-600 font-sans">{preview.text}</pre>
            </div>
          )}
        </div>
      ))}
      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}
