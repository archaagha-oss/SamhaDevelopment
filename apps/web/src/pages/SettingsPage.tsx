import { useState, useEffect } from "react";
import axios from "axios";

interface EmailTemplates {
  beforeDue?: string;
  onDue?: string;
  overdue7?: string;
  overdue30?: string;
}

interface AppSettings {
  id?: string;
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  whatsappNumber?: string;
  smsProvider?: string;
  emailProvider?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUsername?: string;
  smtpPassword?: string;
  paymentInstructions?: string;
  emailTemplates?: EmailTemplates;
  twilioWhatsappFrom?: string;
  twilioMessagingServiceSid?: string;
  twilioWhatsappContentSidBeforeDue?: string;
  twilioWhatsappContentSidOnDue?: string;
  twilioWhatsappContentSidOverdue7?: string;
  twilioWhatsappContentSidOverdue30?: string;
}

type Tab = "company" | "localization" | "communication" | "finance" | "templates";

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const sel = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";

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

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<AppSettings>({
    timezone: "Asia/Dubai",
    currency: "AED",
    dateFormat: "DD/MM/YYYY",
  });

  useEffect(() => {
    axios.get("/api/settings")
      .then((r) => setForm(r.data))
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof AppSettings, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setSaved(null); setError(null);
    try {
      const updated = await axios.patch("/api/settings", form);
      setForm(updated.data);
      setSaved("Settings saved successfully.");
      setTimeout(() => setSaved(null), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "company",       label: "Company Profile" },
    { key: "localization",  label: "Localization" },
    { key: "communication", label: "Communication" },
    { key: "finance",       label: "Finance" },
    { key: "templates",     label: "Email Templates" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">App Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">Organization-level configuration and communication setup</p>
        </div>
        <div className="max-w-3xl mx-auto px-6 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSaved(null); setError(null); }}
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
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex justify-between items-center">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">×</button>
          </div>
        )}
        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <p className="text-sm text-emerald-700">{saved}</p>
          </div>
        )}

        {/* Company Profile */}
        {tab === "company" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company Profile</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={lbl}>Company Name</label>
                <input className={inp} value={form.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} placeholder="e.g. Samha Development" />
              </div>
              <div>
                <label className={lbl}>Logo URL</label>
                <input className={inp} value={form.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className={lbl}>Brand Color (hex)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.primaryColor ?? "#2563eb"}
                    onChange={(e) => set("primaryColor", e.target.value)}
                    className="h-10 w-12 rounded border border-slate-200 cursor-pointer"
                  />
                  <input className={inp} value={form.primaryColor ?? ""} onChange={(e) => set("primaryColor", e.target.value)} placeholder="#2563eb" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Localization */}
        {tab === "localization" && (
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
          </div>
        )}

        {/* Communication */}
        {tab === "communication" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</p>
              <p className="text-xs text-slate-400">Used as the sender for automated emails (future integration).</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>From Name</label>
                  <input className={inp} value={form.defaultFromName ?? ""} onChange={(e) => set("defaultFromName", e.target.value)} placeholder="e.g. Samha Sales Team" />
                </div>
                <div>
                  <label className={lbl}>From Email</label>
                  <input type="email" className={inp} value={form.defaultFromEmail ?? ""} onChange={(e) => set("defaultFromEmail", e.target.value)} placeholder="sales@samha.ae" />
                </div>
                <div>
                  <label className={lbl}>Email Provider</label>
                  <select className={sel} value={form.emailProvider ?? ""} onChange={(e) => set("emailProvider", e.target.value)}>
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
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">WhatsApp & SMS</p>
              <p className="text-xs text-slate-400">Used for direct messaging to leads and contacts.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Display WhatsApp Number</label>
                  <input className={inp} value={form.whatsappNumber ?? ""} onChange={(e) => set("whatsappNumber", e.target.value)} placeholder="+971501234567" />
                </div>
                <div>
                  <label className={lbl}>SMS Provider</label>
                  <select className={sel} value={form.smsProvider ?? ""} onChange={(e) => set("smsProvider", e.target.value)}>
                    <option value="">Not configured</option>
                    <option value="twilio">Twilio</option>
                    <option value="unifonic">Unifonic</option>
                    <option value="stc">STC Pay</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Twilio</p>
              <p className="text-xs text-slate-400">
                Auth token + account SID live in environment variables (<code className="bg-slate-100 px-1 rounded">TWILIO_ACCOUNT_SID</code>, <code className="bg-slate-100 px-1 rounded">TWILIO_AUTH_TOKEN</code>). Configure the public sender details below.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>WhatsApp From</label>
                  <input className={inp} value={form.twilioWhatsappFrom ?? ""} onChange={(e) => set("twilioWhatsappFrom", e.target.value)} placeholder="whatsapp:+14155238886" />
                </div>
                <div>
                  <label className={lbl}>SMS Messaging Service SID</label>
                  <input className={inp} value={form.twilioMessagingServiceSid ?? ""} onChange={(e) => set("twilioMessagingServiceSid", e.target.value)} placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-2">
                Approved Meta Content Template SIDs (start with <code className="bg-slate-100 px-1 rounded">HX</code>) — required for proactive WhatsApp sends outside the 24h service window.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Template: 7 Days Before Due</label>
                  <input className={inp} value={form.twilioWhatsappContentSidBeforeDue ?? ""} onChange={(e) => set("twilioWhatsappContentSidBeforeDue", e.target.value)} placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
                <div>
                  <label className={lbl}>Template: Due Today</label>
                  <input className={inp} value={form.twilioWhatsappContentSidOnDue ?? ""} onChange={(e) => set("twilioWhatsappContentSidOnDue", e.target.value)} placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
                <div>
                  <label className={lbl}>Template: 7 Days Overdue</label>
                  <input className={inp} value={form.twilioWhatsappContentSidOverdue7 ?? ""} onChange={(e) => set("twilioWhatsappContentSidOverdue7", e.target.value)} placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
                <div>
                  <label className={lbl}>Template: 30 Days Overdue (Final)</label>
                  <input className={inp} value={form.twilioWhatsappContentSidOverdue30 ?? ""} onChange={(e) => set("twilioWhatsappContentSidOverdue30", e.target.value)} placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Finance Settings */}
        {tab === "finance" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Payment Instructions</p>
                <p className="text-xs text-slate-400 mb-3">Auto-injected into invoices and reminder emails. Include bank name, account name, IBAN, and Swift code.</p>
                <textarea
                  className={inp + " resize-y min-h-[140px]"}
                  value={form.paymentInstructions ?? ""}
                  onChange={(e) => set("paymentInstructions", e.target.value)}
                  placeholder={`Bank Name: Emirates NBD\nAccount Name: Samha Development LLC\nIBAN: AE123456789012345678\nSwift Code: EBILAEAD`}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SMTP Email Delivery</p>
              <p className="text-xs text-slate-400">Requires nodemailer to be installed. Leave blank to use console logging (development).</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>SMTP Host</label>
                  <input className={inp} value={form.smtpHost ?? ""} onChange={(e) => set("smtpHost", e.target.value)} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className={lbl}>SMTP Port</label>
                  <input type="number" className={inp} value={form.smtpPort ?? ""} onChange={(e) => set("smtpPort", e.target.value)} placeholder="587" />
                </div>
                <div>
                  <label className={lbl}>Username</label>
                  <input className={inp} value={form.smtpUsername ?? ""} onChange={(e) => set("smtpUsername", e.target.value)} placeholder="your@email.com" />
                </div>
                <div>
                  <label className={lbl}>Password</label>
                  <input type="password" className={inp} value={form.smtpPassword ?? ""} onChange={(e) => set("smtpPassword", e.target.value)} placeholder="••••••••" />
                </div>
              </div>
            </div>

            {/* Permissions reference matrix */}
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
              <p className="text-xs text-slate-400 mt-3">Roles are managed per user in the Team section. This matrix is for reference only.</p>
            </div>
          </div>
        )}

        {/* Email Templates */}
        {tab === "templates" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
              <p className="font-semibold mb-1">Template Variables</p>
              <p>Use: <code className="bg-amber-100 px-1 rounded">{"{{BuyerName}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{UnitNumber}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{Amount}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{DueDate}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{ProjectName}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{Milestone}}"}</code></p>
            </div>
            {([
              { key: "beforeDue" as const, label: "7 Days Before Due",     desc: "Friendly reminder — sent 7 days before the due date" },
              { key: "onDue"     as const, label: "Payment Due Today",      desc: "Urgent reminder — sent on the due date" },
              { key: "overdue7"  as const, label: "7 Days Overdue",         desc: "Overdue notice — sent 7 days after the due date" },
              { key: "overdue30" as const, label: "30 Days Overdue (Final)",desc: "Final notice — sent 30 days after the due date" },
            ]).map(({ key, label, desc }) => (
              <div key={key} className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
                <p className="text-xs font-semibold text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
                <textarea
                  className={inp + " resize-y min-h-[100px] font-mono text-xs"}
                  value={(form.emailTemplates as EmailTemplates)?.[key] ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      emailTemplates: { ...(f.emailTemplates as EmailTemplates), [key]: e.target.value },
                    }))
                  }
                  placeholder={`Dear {{BuyerName}},\n\nYour payment of {{Amount}} for {{Milestone}} is due on {{DueDate}}.\n\nThank you.`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
