import { useState, useEffect } from "react";
import axios from "axios";

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
}

type Tab = "company" | "localization" | "communication";

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
              <p className="text-xs text-slate-400">Used for direct messaging to leads and contacts (future integration).</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>WhatsApp Number</label>
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
