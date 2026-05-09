import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  useSettings,
  applyBrandFromHex,
  applyBrand2FromHex,
  applyTheme,
  type AppSettings,
  type NotificationPrefs,
} from "../contexts/SettingsContext";
import Modal from "../components/Modal";
import { PageHeader } from "../components/layout";
import { DEFAULT_PRIMARY_HEX, DEFAULT_SECONDARY_HEX } from "@/constants/brand";

type Tab =
  | "company"
  | "localization"
  | "communication"
  | "integrations"
  | "notifications"
  | "finance"
  | "templates"
  | "features"
  | "apikeys"
  | "audit"
  | "system";

const TAB_VALUES: readonly Tab[] = [
  "company", "localization", "communication", "integrations", "notifications",
  "finance", "templates", "features", "apikeys", "audit", "system",
] as const;
function isTab(v: string | null): v is Tab {
  return v != null && (TAB_VALUES as readonly string[]).includes(v);
}

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:border-ring";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";
const sel = inp;

// Brand color presets — each rotates the entire app theme via --brand-h / --brand-s.
const BRAND_PRESETS: { name: string; hex: string; tagline: string }[] = [
  { name: "Ocean",   hex: DEFAULT_PRIMARY_HEX, tagline: "Default · trustworthy" },
  { name: "Indigo",  hex: "#4f46e5", tagline: "Refined · premium" },
  { name: "Violet",  hex: "#7c3aed", tagline: "Creative · luxury" },
  { name: "Teal",    hex: "#0d9488", tagline: "Calm · modern" },
  { name: "Emerald", hex: "#16a34a", tagline: "Growth · positive" },
  { name: "Amber",   hex: "#d97706", tagline: "Warm · hospitality" },
  { name: "Orange",  hex: "#ea580c", tagline: "Bold · energetic" },
  { name: "Crimson", hex: "#dc2626", tagline: "Urgent · sharp" },
  { name: "Slate",   hex: "#475569", tagline: "Minimal · editorial" },
];

// Secondary brand presets — for accents, premium tags, the "active" stage tint,
// and the second chart series. Picked to pair well with most primaries.
const SECONDARY_PRESETS: { name: string; hex: string; tagline: string }[] = [
  { name: "Violet",   hex: DEFAULT_SECONDARY_HEX, tagline: "Default · accents" },
  { name: "Magenta",  hex: "#c026d3", tagline: "Vibrant pair" },
  { name: "Pink",     hex: "#db2777", tagline: "Warm pair" },
  { name: "Rose",     hex: "#e11d48", tagline: "Dramatic pair" },
  { name: "Sky",      hex: "#0284c7", tagline: "Cool pair" },
  { name: "Cyan",     hex: "#0891b2", tagline: "Fresh pair" },
  { name: "Lime",     hex: "#65a30d", tagline: "Earthy pair" },
  { name: "Gold",     hex: "#ca8a04", tagline: "Premium pair" },
  { name: "Charcoal", hex: "#334155", tagline: "Neutral accent" },
];

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
  secondaryColor: string;
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
  twilioWhatsappFrom: string;
  twilioMessagingServiceSid: string;
  twilioWhatsappContentSidBeforeDue: string;
  twilioWhatsappContentSidOnDue: string;
  twilioWhatsappContentSidOverdue7: string;
  twilioWhatsappContentSidOverdue30: string;
  inboundEmailDomain: string;
  sendgridInboundToken: string;
  sendgridInboundTokenSet: boolean;
  paymentInstructions: string;
  emailTemplates: EmailTemplates;
  notificationPrefs: NotificationPrefs;
  theme: "light" | "dark" | "system";
  featureFlags: Record<string, boolean>;
}

function fromSettings(s: AppSettings): Form {
  return {
    companyName:                       s.companyName ?? "",
    logoUrl:                           s.logoUrl ?? "",
    primaryColor:                      s.primaryColor ?? DEFAULT_PRIMARY_HEX,
    secondaryColor:                    s.secondaryColor ?? DEFAULT_SECONDARY_HEX,
    timezone:                          s.timezone,
    currency:                          s.currency,
    dateFormat:                        s.dateFormat,
    defaultFromName:                   s.defaultFromName ?? "",
    defaultFromEmail:                  s.defaultFromEmail ?? "",
    whatsappNumber:                    s.whatsappNumber ?? "",
    smsProvider:                       s.smsProvider ?? "",
    emailProvider:                     s.emailProvider ?? "",
    smtpHost:                          s.smtpHost ?? "",
    smtpPort:                          s.smtpPort != null ? String(s.smtpPort) : "",
    smtpUsername:                      s.smtpUsername ?? "",
    smtpPassword:                      "",
    smtpPasswordSet:                   s.smtpPasswordSet,
    twilioWhatsappFrom:                s.twilioWhatsappFrom ?? "",
    twilioMessagingServiceSid:         s.twilioMessagingServiceSid ?? "",
    twilioWhatsappContentSidBeforeDue: s.twilioWhatsappContentSidBeforeDue ?? "",
    twilioWhatsappContentSidOnDue:     s.twilioWhatsappContentSidOnDue ?? "",
    twilioWhatsappContentSidOverdue7:  s.twilioWhatsappContentSidOverdue7 ?? "",
    twilioWhatsappContentSidOverdue30: s.twilioWhatsappContentSidOverdue30 ?? "",
    inboundEmailDomain:                s.inboundEmailDomain ?? "",
    sendgridInboundToken:              "",
    sendgridInboundTokenSet:           s.sendgridInboundTokenSet,
    paymentInstructions:               s.paymentInstructions ?? "",
    emailTemplates:                    s.emailTemplates ?? {},
    notificationPrefs:                 s.notificationPrefs ?? {},
    theme:                             s.theme ?? "system",
    featureFlags:                      s.featureFlags ?? {},
  };
}

// Tabs that map to a server PATCH section. "apikeys", "audit", "system" are
// handled by their own components and don't go through the generic save flow.
const apiSection: Record<Exclude<Tab, "audit" | "system" | "apikeys">, string> = {
  company: "branding",
  localization: "localization",
  communication: "communication",
  integrations: "integrations",
  notifications: "notifications",
  finance: "finance",
  templates: "templates",
  features: "feature-flags",
};

const labels: Record<Tab, string> = {
  company: "Company profile",
  localization: "Localization",
  communication: "Communication",
  integrations: "Integrations",
  notifications: "Notifications",
  finance: "Finance",
  templates: "Email templates",
  features: "Feature flags",
  apikeys: "API keys",
  audit: "Audit log",
  system: "System info",
};

// ─── Reason modal — replaces window.prompt() ───────────────────────────────

interface ReasonRequest {
  section: Exclude<Tab, "audit" | "system" | "apikeys">;
  body: Record<string, unknown>;
  resolve: (reason: string | null) => void;
}

function ReasonPrompt({ open, section, onCancel, onConfirm }: {
  open: boolean;
  section: Exclude<Tab, "audit" | "system" | "apikeys"> | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!section) return null;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Save ${labels[section].toLowerCase()}?`}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
          >
            Confirm save
          </button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-3">
        <p className="text-sm text-foreground">
          Add an optional reason to help future admins understand why this changed.
        </p>
        <div>
          <label className={lbl}>Reason (optional)</label>
          <textarea
            className={inp + " min-h-[90px]"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Migrated to new SendGrid account, see ticket OPS-1042"
            autoFocus
            maxLength={1000}
          />
          <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{reason.length} / 1000</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Recorded in the audit log alongside who changed what and when.
        </p>
      </div>
    </Modal>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, isLoading, refresh } = useSettings();
  // Each tab is a real sub-route (/settings/<tabKey>) — Phase D replaced the
  // earlier ?tab= query-state with proper nested routes. Browser back, deep
  // links, bookmarks and copy-paste-share all work.
  const navigate = useNavigate();
  const { tabKey } = useParams<{ tabKey?: string }>();
  const tab: Tab = isTab(tabKey ?? null) ? (tabKey as Tab) : "company";

  // Redirect /settings → /settings/company so every tab has a canonical URL.
  useEffect(() => {
    if (!tabKey) navigate("/settings/company", { replace: true });
  }, [tabKey, navigate]);

  const [form, setForm] = useState<Form>(() => fromSettings(settings));
  const [saving, setSaving] = useState<string | null>(null);
  const [reasonReq, setReasonReq] = useState<ReasonRequest | null>(null);

  useEffect(() => { setForm(fromSettings(settings)); }, [settings]);

  const set = <K extends keyof Form>(key: K, val: Form[K]) => setForm((f) => ({ ...f, [key]: val }));

  function requestReason(section: Exclude<Tab, "audit" | "system" | "apikeys">, body: Record<string, unknown>): Promise<string | null> {
    return new Promise((resolve) => setReasonReq({ section, body, resolve }));
  }

  async function save(section: Exclude<Tab, "audit" | "system" | "apikeys">, body: Record<string, unknown>) {
    const reason = await requestReason(section, body);
    if (reason === null) return; // cancelled
    setSaving(section);
    try {
      await axios.patch(`/api/settings/${apiSection[section]}`, {
        ...body,
        ...(reason.trim() ? { _reason: reason.trim() } : {}),
      });
      await refresh();
      toast.success(`${labels[section]} saved`);
    } catch (e: any) {
      const details = e.response?.data?.details;
      toast.error(details?.[0] ?? e.response?.data?.error ?? "Save failed");
    } finally {
      setSaving(null);
    }
  }

  const tabs: { key: Tab; label: string; group: "config" | "ops" }[] = [
    { key: "company",        label: "Company",       group: "config" },
    { key: "localization",   label: "Localization",  group: "config" },
    { key: "communication",  label: "Communication", group: "config" },
    { key: "integrations",   label: "Integrations",  group: "config" },
    { key: "notifications",  label: "Notifications", group: "config" },
    { key: "finance",        label: "Finance",       group: "config" },
    { key: "templates",      label: "Templates",     group: "config" },
    { key: "features",       label: "Feature Flags", group: "config" },
    { key: "apikeys",        label: "API Keys",      group: "ops" },
    { key: "audit",          label: "Audit Log",     group: "ops" },
    { key: "system",         label: "System Info",   group: "ops" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Settings" }]}
        title="App Settings"
        subtitle="Organization-level configuration and operational tools. All changes are recorded in the audit log."
        tabs={
          <div
            className="flex gap-1 overflow-x-auto scrollbar-thin"
            role="tablist"
            aria-label="Settings sections"
          >
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <Link
                  key={t.key}
                  to={`/settings/${t.key}`}
                  role="tab"
                  aria-selected={active}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        }
      />

      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-5 space-y-5">
        {tab === "company"        && <CompanySection        form={form} set={set} saving={saving === "company"}        onSave={() => save("company",        { companyName: form.companyName, logoUrl: form.logoUrl, primaryColor: form.primaryColor, secondaryColor: form.secondaryColor, theme: form.theme })} />}
        {tab === "localization"   && <LocalizationSection   form={form} set={set} saving={saving === "localization"}   onSave={() => save("localization",   { timezone: form.timezone, currency: form.currency, dateFormat: form.dateFormat })} />}
        {tab === "communication"  && <CommunicationSection  form={form} set={set} saving={saving === "communication"}  onSave={() => save("communication",  communicationBody(form))} />}
        {tab === "integrations"   && <IntegrationsSection   form={form} set={set} saving={saving === "integrations"}   onSave={() => save("integrations",   integrationsBody(form))} />}
        {tab === "notifications"  && <NotificationsSection  form={form} set={set} saving={saving === "notifications"}  onSave={() => save("notifications",  { notificationPrefs: form.notificationPrefs })} />}
        {tab === "finance"        && <FinanceSection        form={form} set={set} saving={saving === "finance"}        onSave={() => save("finance",        { paymentInstructions: form.paymentInstructions })} />}
        {tab === "templates"      && <TemplatesSection      form={form} set={set} saving={saving === "templates"}      onSave={() => save("templates",      { emailTemplates: form.emailTemplates })} />}
        {tab === "features"       && <FeatureFlagsSection   form={form} set={set} saving={saving === "features"}     onSave={() => save("features",      { featureFlags: form.featureFlags })} />}
        {tab === "apikeys"        && <ApiKeysSection />}
        {tab === "audit"          && <AuditLogSection />}
        {tab === "system"         && <SystemInfoSection />}
      </div>

      <ReasonPrompt
        open={!!reasonReq}
        section={reasonReq?.section ?? null}
        onCancel={() => { reasonReq?.resolve(null); setReasonReq(null); }}
        onConfirm={(r) => { reasonReq?.resolve(r); setReasonReq(null); }}
      />
    </div>
  );
}

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
  if (f.smtpPassword.length > 0) body.smtpPassword = f.smtpPassword;
  return body;
}

function integrationsBody(f: Form) {
  const body: Record<string, unknown> = {
    twilioWhatsappFrom:                f.twilioWhatsappFrom,
    twilioMessagingServiceSid:         f.twilioMessagingServiceSid,
    twilioWhatsappContentSidBeforeDue: f.twilioWhatsappContentSidBeforeDue,
    twilioWhatsappContentSidOnDue:     f.twilioWhatsappContentSidOnDue,
    twilioWhatsappContentSidOverdue7:  f.twilioWhatsappContentSidOverdue7,
    twilioWhatsappContentSidOverdue30: f.twilioWhatsappContentSidOverdue30,
    inboundEmailDomain:                f.inboundEmailDomain,
  };
  if (f.sendgridInboundToken.length > 0) body.sendgridInboundToken = f.sendgridInboundToken;
  return body;
}

// ─── Section components ─────────────────────────────────────────────────────

interface SectionProps {
  form: Form;
  set: <K extends keyof Form>(key: K, val: Form[K]) => void;
  saving: boolean;
  onSave: () => void;
}

function Card({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
          {description && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SaveBar({ saving, onSave, label = "Save section" }: { saving: boolean; onSave: () => void; label?: string }) {
  return (
    <div className="flex justify-end pt-2 sticky bottom-0 bg-background pb-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}

function SecretIndicator({ isSet }: { isSet: boolean }) {
  return (
    <span className={`ml-2 text-[10px] font-normal ${isSet ? "text-success" : "text-muted-foreground"}`}>
      {isSet ? "● set" : "not set"}
    </span>
  );
}

// ─── Company / Branding ─────────────────────────────────────────────────────

function CompanySection({ form, set, saving, onSave }: SectionProps) {
  const { settings: savedSettings } = useSettings();
  const currentPreset      = BRAND_PRESETS.find((p) => p.hex.toLowerCase() === (form.primaryColor || "").toLowerCase());
  const currentPreset2     = SECONDARY_PRESETS.find((p) => p.hex.toLowerCase() === (form.secondaryColor || "").toLowerCase());
  const validHex           = /^#[0-9a-fA-F]{6}$/.test(form.primaryColor);
  const validHex2          = /^#[0-9a-fA-F]{6}$/.test(form.secondaryColor);

  // Live preview — apply both axes immediately so the user sees the entire app
  // re-skin before saving. On unmount, revert to the saved values.
  useEffect(() => { if (validHex)  applyBrandFromHex(form.primaryColor); },     [form.primaryColor, validHex]);
  useEffect(() => { if (validHex2) applyBrand2FromHex(form.secondaryColor); }, [form.secondaryColor, validHex2]);
  useEffect(() => () => {
    applyBrandFromHex(savedSettings.primaryColor);
    applyBrand2FromHex(savedSettings.secondaryColor);
  }, [savedSettings.primaryColor, savedSettings.secondaryColor]);

  // Live theme preview — flip the data-theme attribute as the user picks.
  useEffect(() => { applyTheme(form.theme); }, [form.theme]);
  useEffect(() => () => { applyTheme(savedSettings.theme ?? "system"); }, [savedSettings.theme]);

  return (
    <div className="space-y-4">
      <Card title="Company Profile">
        <div className="space-y-4">
          <div>
            <label className={lbl}>Company Name</label>
            <input className={inp} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="e.g. Samha Development" />
          </div>
          <div>
            <label className={lbl}>Logo URL</label>
            <input className={inp} value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://cdn.samha.ae/logo.png" />
            {form.logoUrl && /^https?:\/\//.test(form.logoUrl) && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg border border-border">
                <img src={form.logoUrl} alt="Logo preview" className="h-8 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
                <span className="text-[11px] text-muted-foreground">Preview</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Primary Brand" description="Drives primary buttons, focus rings, brand-tinted backgrounds, links, and the first chart series — across every screen.">
        <div>
          <label className={lbl}>Preset palettes</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {BRAND_PRESETS.map((p) => {
              const active = p.hex.toLowerCase() === (form.primaryColor || "").toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => set("primaryColor", p.hex)}
                  aria-pressed={active}
                  title={p.tagline}
                  className={`group flex flex-col items-stretch gap-2 p-2 rounded-lg border-2 transition-colors text-left ${
                    active ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  <span className="block w-full h-10 rounded-md shadow-sm" style={{ background: p.hex }} aria-hidden="true" />
                  <div className="px-0.5">
                    <p className="text-xs font-semibold text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">{p.hex.toUpperCase()}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={lbl}>{currentPreset ? "Or pick a custom color" : "Custom color"}</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={validHex ? form.primaryColor : DEFAULT_PRIMARY_HEX}
              onChange={(e) => set("primaryColor", e.target.value)}
              className="h-10 w-12 rounded-lg border border-border cursor-pointer"
              aria-label="Primary color picker"
            />
            <input
              className={inp}
              value={form.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
              placeholder={DEFAULT_PRIMARY_HEX}
              aria-invalid={!validHex}
            />
          </div>
          {!validHex && form.primaryColor && (
            <p className="text-[11px] text-destructive mt-1">Must be a 6-digit hex like {DEFAULT_PRIMARY_HEX}</p>
          )}
        </div>
      </Card>

      <Card title="Secondary Brand" description="Accent color for premium tags, the violet-tinted &quot;active&quot; stage, and the second chart series. Pick one that contrasts well with your primary.">
        <div>
          <label className={lbl}>Preset palettes</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {SECONDARY_PRESETS.map((p) => {
              const active = p.hex.toLowerCase() === (form.secondaryColor || "").toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => set("secondaryColor", p.hex)}
                  aria-pressed={active}
                  title={p.tagline}
                  className={`group flex flex-col items-stretch gap-2 p-2 rounded-lg border-2 transition-colors text-left ${
                    active ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  <span className="block w-full h-10 rounded-md shadow-sm" style={{ background: p.hex }} aria-hidden="true" />
                  <div className="px-0.5">
                    <p className="text-xs font-semibold text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">{p.hex.toUpperCase()}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={lbl}>{currentPreset2 ? "Or pick a custom color" : "Custom color"}</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={validHex2 ? form.secondaryColor : DEFAULT_SECONDARY_HEX}
              onChange={(e) => set("secondaryColor", e.target.value)}
              className="h-10 w-12 rounded-lg border border-border cursor-pointer"
              aria-label="Secondary color picker"
            />
            <input
              className={inp}
              value={form.secondaryColor}
              onChange={(e) => set("secondaryColor", e.target.value)}
              placeholder={DEFAULT_SECONDARY_HEX}
              aria-invalid={!validHex2}
            />
          </div>
          {!validHex2 && form.secondaryColor && (
            <p className="text-[11px] text-destructive mt-1">Must be a 6-digit hex like {DEFAULT_SECONDARY_HEX}</p>
          )}
        </div>
      </Card>

      <Card title="Live preview" description="Both brand colors applied across the most-affected UI elements.">
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg shadow-sm hover:bg-primary/90 transition-colors">Primary action</button>
            <button type="button" className="px-3 py-1.5 bg-accent-2 text-accent-2-foreground text-xs font-semibold rounded-lg shadow-sm hover:bg-accent-2/90 transition-colors">Accent action</button>
            <button type="button" className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors">Neutral</button>
            <button type="button" className="px-3 py-1.5 border border-primary/40 text-primary text-xs font-semibold rounded-lg hover:bg-primary/10 transition-colors">Outlined</button>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-xs text-primary hover:underline font-medium">Link text →</a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 bg-info-soft text-info-soft-foreground rounded-full text-[11px] font-medium">Info</span>
            <span className="px-2.5 py-0.5 bg-stage-progress text-stage-progress-foreground rounded-full text-[11px] font-medium">Stage progress</span>
            <span className="px-2.5 py-0.5 bg-stage-active text-stage-active-foreground rounded-full text-[11px] font-medium">Stage active</span>
            <span className="px-2.5 py-0.5 bg-brand-100 text-brand-700 rounded-full text-[11px] font-medium">Primary tint</span>
            <span className="px-2.5 py-0.5 bg-accent-2-soft text-accent-2-soft-foreground rounded-full text-[11px] font-medium">Accent tint</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="text-muted-foreground">Chart series:</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-chart-1" /><span className="text-muted-foreground">1 · Primary</span></span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-chart-2" /><span className="text-muted-foreground">2 · Accent</span></span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-chart-3" /><span className="text-muted-foreground">3 · Amber</span></span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent-2" /><span className="text-muted-foreground">4 · Emerald</span></span>
          </div>
        </div>

        <div className="pt-1 border-t border-border">
          <div className="flex items-start gap-3 pt-4">
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground mb-1">Status colors are fixed</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Success / warning / error keep universal meanings (green = good, amber = caution, red = problem)
                and don't change with the brand. Same goes for neutral grays used for surfaces and text.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 flex-shrink-0">
              <div title="Success" className="w-7 h-7 rounded-md bg-success" aria-hidden="true" />
              <div title="Warning" className="w-7 h-7 rounded-md bg-warning" aria-hidden="true" />
              <div title="Destructive" className="w-7 h-7 rounded-md bg-destructive" aria-hidden="true" />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Appearance" description="Light, dark, or follow the operating-system preference. Applies app-wide.">
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "light"  as const, label: "Light",  hint: "Bright surfaces" },
            { value: "dark"   as const, label: "Dark",   hint: "Easy on the eyes" },
            { value: "system" as const, label: "System", hint: "Follow OS" },
          ]).map(({ value, label, hint }) => {
            const active = form.theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => set("theme", value)}
                aria-pressed={active}
                className={`flex flex-col items-stretch gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                  active ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30 hover:bg-muted/30"
                }`}
              >
                {/* eslint-disable-next-line — these swatches MUST be literal black/white
                    so the preview actually shows what each theme looks like. Tokens
                    would re-paint them with the active theme and defeat the point. */}
                <div className={`h-12 rounded-md flex items-center justify-center ${
                  value === "dark"  ? "bg-neutral-900 text-neutral-50" :
                  value === "light" ? "bg-neutral-50 border border-neutral-200 text-neutral-900" :
                                      "bg-gradient-to-r from-neutral-50 to-neutral-900 text-foreground"
                }`}>
                  <span className="text-[10px] font-bold tracking-wide">{label.toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

// ─── Localization ───────────────────────────────────────────────────────────

function LocalizationSection({ form, set, saving, onSave }: SectionProps) {
  const sampleAmount = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: form.currency }).format(1234567.89);
    } catch { return `${form.currency} 1,234,567.89`; }
  }, [form.currency]);
  const sampleDate = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    if (form.dateFormat === "MM/DD/YYYY") return `${mm}/${dd}/${yyyy}`;
    if (form.dateFormat === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  }, [form.dateFormat]);

  return (
    <div className="space-y-4">
      <Card title="Localization">
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

        <div className="rounded-lg border border-border bg-muted/30 p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Sample amount</p>
            <p className="text-sm text-foreground tabular-nums">{sampleAmount}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Sample date (today)</p>
            <p className="text-sm text-foreground tabular-nums">{sampleDate}</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">Applied app-wide to amounts and dates after saving.</p>
      </Card>
      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

// ─── Communication ──────────────────────────────────────────────────────────

function CommunicationSection({ form, set, saving, onSave }: SectionProps) {
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  async function testSmtp() {
    if (!testTo) { toast.error("Enter a destination email"); return; }
    setTesting(true);
    try {
      await axios.post("/api/settings/test-smtp", { to: testTo });
      toast.success(`Test email sent to ${testTo}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const smtpReady = form.smtpHost && form.smtpPort && (form.smtpPasswordSet || form.smtpPassword.length > 0);

  return (
    <div className="space-y-4">
      <Card title="Email Sender">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>From Name</label>
            <input className={inp} value={form.defaultFromName} onChange={(e) => set("defaultFromName", e.target.value)} placeholder="e.g. Samha Sales Team" />
          </div>
          <div>
            <label className={lbl}>From Email</label>
            <input type="email" className={inp} value={form.defaultFromEmail} onChange={(e) => set("defaultFromEmail", e.target.value)} placeholder="sales@samha.ae" />
          </div>
          <div className="col-span-2">
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
      </Card>

      <Card
        title="SMTP Delivery"
        description="Used when Email Provider is set to SMTP. Password is one-way — it's never returned to the browser, only saved when you enter a new value."
        action={smtpReady ? <span className="text-[10px] font-semibold text-success bg-success-soft px-2 py-1 rounded-full">● Ready</span> : <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full">Incomplete</span>}
      >
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
            <input className={inp} value={form.smtpUsername} onChange={(e) => set("smtpUsername", e.target.value)} placeholder="your@email.com" autoComplete="off" />
          </div>
          <div>
            <label className={lbl}>Password<SecretIndicator isSet={form.smtpPasswordSet} /></label>
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
            disabled={testing || !smtpReady}
            title={!smtpReady ? "Save SMTP config first" : "Send a real test email"}
            className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? "Sending…" : "Test SMTP"}
          </button>
        </div>
      </Card>

      <Card title="WhatsApp & SMS" description="Channel routing. Twilio credentials and Content SIDs are configured under Integrations.">
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
      </Card>

      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

// ─── Integrations (Twilio + Inbound Email) ──────────────────────────────────

function IntegrationsSection({ form, set, saving, onSave }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="bg-info-soft border border-info-soft-foreground/20 rounded-xl px-4 py-3 text-xs text-info-soft-foreground">
        <p className="font-semibold mb-1">Secrets vs operator config</p>
        <p className="leading-relaxed">
          Twilio Account SID, Auth Token, and Webhook Signing Secret remain in env vars and require a redeploy
          to rotate. The fields below are operator-managed and can be changed at runtime.
        </p>
      </div>

      <Card title="Twilio — WhatsApp & SMS">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>WhatsApp From</label>
            <input className={inp} value={form.twilioWhatsappFrom} onChange={(e) => set("twilioWhatsappFrom", e.target.value)} placeholder="whatsapp:+14155238886" />
          </div>
          <div>
            <label className={lbl}>SMS Messaging Service SID</label>
            <input className={inp} value={form.twilioMessagingServiceSid} onChange={(e) => set("twilioMessagingServiceSid", e.target.value)} placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
        </div>
      </Card>

      <Card title="WhatsApp Content Templates" description="Approved Twilio template SIDs used for payment-reminder messages.">
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "twilioWhatsappContentSidBeforeDue" as const, label: "7 Days Before Due" },
            { key: "twilioWhatsappContentSidOnDue" as const,     label: "On Due Date" },
            { key: "twilioWhatsappContentSidOverdue7" as const,  label: "7 Days Overdue" },
            { key: "twilioWhatsappContentSidOverdue30" as const, label: "30 Days Overdue" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className={lbl}>{label}</label>
              <input className={inp} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Inbound Email Capture"
        description="Configure where incoming replies land so they auto-attach to the right deal."
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Inbound Domain</label>
            <input className={inp} value={form.inboundEmailDomain} onChange={(e) => set("inboundEmailDomain", e.target.value)} placeholder="inbound.samha.ae" />
            <p className="text-[11px] text-muted-foreground mt-1">Replies route through Reply-To: <code className="bg-muted px-1 rounded">reply+&lt;activityId&gt;@{form.inboundEmailDomain || "domain"}</code></p>
          </div>
          <div>
            <label className={lbl}>SendGrid Inbound Token<SecretIndicator isSet={form.sendgridInboundTokenSet} /></label>
            <input
              type="password"
              className={inp}
              value={form.sendgridInboundToken}
              onChange={(e) => set("sendgridInboundToken", e.target.value)}
              placeholder={form.sendgridInboundTokenSet ? "•••••••• (leave blank to keep)" : "Enter token"}
              autoComplete="new-password"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Path token guarding <code className="bg-muted px-1 rounded">/api/webhooks/email/inbound/:token</code></p>
          </div>
        </div>
      </Card>

      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

// ─── Notifications ──────────────────────────────────────────────────────────

const NOTIFICATION_EVENTS: { key: string; label: string; desc: string }[] = [
  { key: "leadAssigned",      label: "Lead Assigned",       desc: "When a new lead is routed to you" },
  { key: "dealStageChanged",  label: "Deal Stage Changed",  desc: "Movement across the deal pipeline" },
  { key: "paymentDue",        label: "Payment Due",         desc: "Upcoming or overdue installments" },
  { key: "paymentReceived",   label: "Payment Received",    desc: "Confirmation when a payment lands" },
  { key: "documentUploaded",  label: "Document Uploaded",   desc: "New file attached to a deal/lead" },
  { key: "taskAssigned",      label: "Task Assigned",       desc: "New task on your queue" },
  { key: "commissionUnlocked",label: "Commission Unlocked", desc: "Your commission becomes payable" },
  { key: "kycExpiring",       label: "KYC Expiring",        desc: "Buyer documents nearing expiry" },
];

function NotificationsSection({ form, set, saving, onSave }: SectionProps) {
  const prefs: NotificationPrefs = form.notificationPrefs ?? {};
  const channels = prefs.channels ?? { inApp: true, email: true, sms: false, whatsapp: false };
  const events = prefs.events ?? {};
  const quietHours = prefs.quietHours ?? { enabled: false, start: "22:00", end: "08:00" };

  function setChannel(c: keyof NonNullable<NotificationPrefs["channels"]>, val: boolean) {
    set("notificationPrefs", { ...prefs, channels: { ...channels, [c]: val } });
  }
  function setEvent(eventKey: string, channel: "inApp" | "email" | "sms" | "whatsapp", val: boolean) {
    set("notificationPrefs", {
      ...prefs,
      events: { ...events, [eventKey]: { ...(events[eventKey] ?? {}), [channel]: val } },
    });
  }
  function setQuiet<K extends keyof NonNullable<NotificationPrefs["quietHours"]>>(k: K, v: NonNullable<NotificationPrefs["quietHours"]>[K]) {
    set("notificationPrefs", { ...prefs, quietHours: { ...quietHours, [k]: v } });
  }

  return (
    <div className="space-y-4">
      <Card title="Channel Master Switches" description="Toggling a channel off here disables it for every event below.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { k: "inApp" as const,    label: "In-App" },
            { k: "email" as const,    label: "Email" },
            { k: "sms" as const,      label: "SMS" },
            { k: "whatsapp" as const, label: "WhatsApp" },
          ]).map(({ k, label }) => (
            <label key={k} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${channels[k] ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-muted/30"}`}>
              <span className="text-sm font-medium text-foreground">{label}</span>
              <input type="checkbox" checked={!!channels[k]} onChange={(e) => setChannel(k, e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Per-Event Routing" description="Pick which channels to use for each event type. Disabled when the channel master switch is off.">
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</th>
                {(["inApp", "email", "sms", "whatsapp"] as const).map((c) => (
                  <th key={c} className="py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {c === "inApp" ? "In-App" : c[0]?.toUpperCase() + c.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {NOTIFICATION_EVENTS.map(({ key, label, desc }) => {
                const ev = events[key] ?? {};
                return (
                  <tr key={key}>
                    <td className="py-2.5 px-2">
                      <p className="text-sm text-foreground font-medium">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </td>
                    {(["inApp", "email", "sms", "whatsapp"] as const).map((c) => {
                      const channelOn = !!channels[c];
                      const checked = !!(ev as any)[c];
                      return (
                        <td key={c} className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked && channelOn}
                            disabled={!channelOn}
                            onChange={(e) => setEvent(key, c, e.target.checked)}
                            className="h-4 w-4 accent-primary disabled:opacity-30"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Quiet Hours" description="Suppress non-urgent notifications during a daily window. Urgent alerts (overdue, escalations) still come through.">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={quietHours.enabled} onChange={(e) => setQuiet("enabled", e.target.checked)} className="h-4 w-4 accent-primary" />
            <span className="text-sm text-foreground">Enable quiet hours</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Start</label>
            <input type="time" className={inp} value={quietHours.start} disabled={!quietHours.enabled} onChange={(e) => setQuiet("start", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>End</label>
            <input type="time" className={inp} value={quietHours.end} disabled={!quietHours.enabled} onChange={(e) => setQuiet("end", e.target.value)} />
          </div>
        </div>
      </Card>

      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

// ─── Finance ────────────────────────────────────────────────────────────────

function FinanceSection({ form, set, saving, onSave }: SectionProps) {
  return (
    <div className="space-y-4">
      <Card title="Payment Instructions" description="Auto-injected into invoices and reminder emails. Include bank name, account name, IBAN, and Swift code.">
        <textarea
          className={inp + " resize-y min-h-[140px] font-mono text-xs"}
          value={form.paymentInstructions}
          onChange={(e) => set("paymentInstructions", e.target.value)}
          placeholder={`Bank Name: Emirates NBD\nAccount Name: Samha Development LLC\nIBAN: AE123456789012345678\nSwift Code: EBILAEAD`}
        />
      </Card>

      <PermissionsMatrix />
      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

function PermissionsMatrix() {
  return (
    <Card title="Role Permissions Reference">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
              {["Admin", "Manager", "Member", "Viewer"].map((r) => (
                <th key={r} className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              ["Create Deal",          true,  true,  true,  false],
              ["Reserve Unit",         true,  true,  true,  false],
              ["Record Payment",       true,  false, false, false],
              ["Generate Receipt",     true,  false, false, false],
              ["Manage Settings",      true,  false, false, false],
              ["View Audit Log",       true,  false, false, false],
              ["View Reports",         true,  true,  true,  true ],
              ["Manage Users",         true,  false, false, false],
            ].map(([action, ...perms]) => (
              <tr key={String(action)}>
                <td className="py-2.5 pr-4 text-sm text-foreground">{action}</td>
                {perms.map((allowed, i) => (
                  <td key={i} className="py-2.5 px-3 text-center">
                    <span className={allowed ? "text-success font-bold" : "text-foreground/30"}>{allowed ? "✓" : "–"}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Roles are managed per user in the Team section. Functional access (e.g. Finance approves payments) is enforced by department membership, not role.
      </p>
    </Card>
  );
}

// ─── Templates ──────────────────────────────────────────────────────────────

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
    { key: "beforeDue" as const, label: "7 Days Before Due",       desc: "Friendly reminder — sent 7 days before the due date" },
    { key: "onDue"     as const, label: "Payment Due Today",       desc: "Urgent reminder — sent on the due date" },
    { key: "overdue7"  as const, label: "7 Days Overdue",          desc: "Overdue notice — sent 7 days after the due date" },
    { key: "overdue30" as const, label: "30 Days Overdue (Final)", desc: "Final notice — sent 30 days after the due date" },
  ]), []);

  return (
    <div className="space-y-4">
      <div className="bg-warning-soft border border-warning/30 rounded-xl px-4 py-3 text-xs text-warning">
        <p className="font-semibold mb-1">Available Variables</p>
        <p className="leading-relaxed">
          {["{{BuyerName}}", "{{UnitNumber}}", "{{Amount}}", "{{DueDate}}", "{{ProjectName}}", "{{Milestone}}"].map((v) => (
            <code key={v} className="bg-warning-soft px-1 rounded mr-1.5">{v}</code>
          ))}
        </p>
      </div>
      {templates.map(({ key, label, desc }) => (
        <div key={key} className="bg-card rounded-xl border border-border p-6 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <button
              onClick={() => loadPreview(key)}
              className="text-xs px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-semibold disabled:opacity-50"
              disabled={previewing && previewKey === key}
            >
              {previewing && previewKey === key ? "Loading…" : "Preview"}
            </button>
          </div>
          <textarea
            className={inp + " resize-y min-h-[100px] font-mono text-xs"}
            value={form.emailTemplates[key] ?? ""}
            onChange={(e) => set("emailTemplates", { ...form.emailTemplates, [key]: e.target.value })}
            placeholder={`Dear {{BuyerName}},\n\nYour payment of {{Amount}} for {{Milestone}} is due on {{DueDate}}.\n\nThank you.`}
          />
          {previewKey === key && preview && (
            <div className="mt-3 border border-border rounded-lg p-3 bg-muted/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Preview</p>
              <p className="text-xs font-bold text-foreground mb-2">{preview.subject}</p>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-sans">{preview.text}</pre>
            </div>
          )}
        </div>
      ))}
      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

// ─── Audit log viewer ───────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  section: string;
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { name: string; email: string; role: string } | null;
}

function AuditLogSection() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await axios.get("/api/settings/audit-log", {
        params: { limit: 100, section: section || undefined },
      });
      setItems(r.data.data || []);
      setTotal(r.data.total ?? 0);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [section]);

  const sections = ["", "branding", "localization", "communication", "integrations", "finance", "templates", "notifications", "feature-flags", "api-keys", "legacy"];

  function exportCsv() {
    // Authoritative URL — opens in a new tab and triggers the download via Content-Disposition.
    const params = new URLSearchParams();
    params.set("format", "csv");
    if (section) params.set("section", section);
    window.open(`/api/settings/audit-log?${params.toString()}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audit Log</p>
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{total} entries — admin-only, last 100 shown</p>
          </div>
          <div className="flex gap-2 items-center">
            <select className={sel + " w-44"} value={section} onChange={(e) => setSection(e.target.value)}>
              {sections.map((s) => <option key={s} value={s}>{s ? s : "All sections"}</option>)}
            </select>
            <button onClick={exportCsv} className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg" title="Download up to 1000 rows as CSV">
              Export CSV
            </button>
            <button onClick={load} disabled={loading} className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg disabled:opacity-50">
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {items.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground py-12 text-center">No settings changes recorded yet.</p>
        )}

        <div className="divide-y divide-border">
          {items.map((it) => (
            <div key={it.id} className="py-3">
              <button
                onClick={() => setExpanded((id) => (id === it.id ? null : it.id))}
                className="w-full flex items-start justify-between gap-3 text-left hover:bg-muted/30 rounded-lg px-2 py-1 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-muted text-foreground">{it.section}</span>
                    <span className="text-xs text-foreground font-medium truncate">{it.changedFields.join(", ")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {it.user ? `${it.user.name} (${it.user.role})` : "Unknown user"}
                    {" · "}
                    {new Date(it.createdAt).toLocaleString()}
                    {it.ip ? ` · ${it.ip}` : ""}
                  </p>
                  {it.reason && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{it.reason}"</p>
                  )}
                </div>
                <span className="text-muted-foreground text-xs flex-shrink-0">{expanded === it.id ? "▾" : "▸"}</span>
              </button>
              {expanded === it.id && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 px-2">
                  <div className="bg-destructive-soft border border-destructive/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-destructive uppercase mb-1">Before</p>
                    <pre className="text-[11px] text-foreground whitespace-pre-wrap font-mono break-all">
                      {JSON.stringify(it.before ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div className="bg-success-soft border border-success/30 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-success uppercase mb-1">After</p>
                    <pre className="text-[11px] text-foreground whitespace-pre-wrap font-mono break-all">
                      {JSON.stringify(it.after ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── System info / diagnostics ──────────────────────────────────────────────

interface SystemInfo {
  app: { nodeEnv: string; nodeVersion: string; uptimeSeconds: number; clerkAuth: boolean; memoryMb: number };
  organization: { id: string; name: string; country: string } | null;
  database: { ok: boolean; latencyMs: number; error: string | null };
  counts: { users: number; deals: number; units: number; leads: number; settingsAuditEntries: number };
  backgroundJobs: { pending: number };
}

function SystemInfoSection() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await axios.get<SystemInfo>("/api/settings/system-info");
      setInfo(r.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to load system info");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (loading && !info) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!info) return null;

  const uptimeStr = formatDuration(info.app.uptimeSeconds);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={load} disabled={loading} className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg disabled:opacity-50">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <Card title="Application">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Row label="Environment" value={info.app.nodeEnv} highlight={info.app.nodeEnv === "production" ? "success" : "warning"} />
          <Row label="Node version" value={info.app.nodeVersion} />
          <Row label="Uptime" value={uptimeStr} />
          <Row label="Memory (RSS)" value={`${info.app.memoryMb} MB`} />
          <Row label="Clerk auth" value={info.app.clerkAuth ? "Enabled" : "Disabled (dev mock)"} highlight={info.app.clerkAuth ? "success" : "warning"} />
        </dl>
      </Card>

      <Card title="Database">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Row label="Status" value={info.database.ok ? "Connected" : "Error"} highlight={info.database.ok ? "success" : "destructive"} />
          <Row label="Round-trip latency" value={`${info.database.latencyMs} ms`} highlight={info.database.latencyMs > 200 ? "warning" : "success"} />
          {info.database.error && <Row label="Error" value={info.database.error} highlight="destructive" />}
        </dl>
      </Card>

      <Card title="Organization">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Row label="Name" value={info.organization?.name ?? "—"} />
          <Row label="Country" value={info.organization?.country ?? "—"} />
          <Row label="ID" value={<code className="text-[11px]">{info.organization?.id ?? "—"}</code>} />
        </dl>
      </Card>

      <Card title="Data Counts">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <Row label="Users" value={info.counts.users} />
          <Row label="Leads" value={info.counts.leads} />
          <Row label="Deals" value={info.counts.deals} />
          <Row label="Units" value={info.counts.units} />
          <Row label="Audit entries" value={info.counts.settingsAuditEntries} />
          <Row label="Background jobs (pending)" value={info.backgroundJobs.pending} highlight={info.backgroundJobs.pending > 100 ? "warning" : undefined} />
        </dl>
      </Card>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: ReactNode; highlight?: "success" | "warning" | "destructive" }) {
  const color =
    highlight === "success" ? "text-success" :
    highlight === "warning" ? "text-warning" :
    highlight === "destructive" ? "text-destructive" :
    "text-foreground";
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</dt>
      <dd className={`text-sm tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Feature flags ──────────────────────────────────────────────────────────

interface FlagDefinition {
  key: string;
  label: string;
  description: string;
  default: boolean;
}

function FeatureFlagsSection({ form, set, saving, onSave }: SectionProps) {
  const [catalog, setCatalog] = useState<FlagDefinition[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCatalog(true);
      try {
        const r = await axios.get<{ flags: FlagDefinition[] }>("/api/settings/feature-flags/catalog");
        if (!cancelled) setCatalog(r.data.flags ?? []);
      } catch {
        // catalog is purely informational; UI degrades gracefully
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function setFlag(key: string, value: boolean) {
    set("featureFlags", { ...form.featureFlags, [key]: value });
  }

  const enabledCount = catalog.filter((f) => (f.key in form.featureFlags ? form.featureFlags[f.key] : f.default)).length;

  return (
    <div className="space-y-4">
      <Card
        title="Feature Flags"
        description="Toggle in-development modules without redeploying. Changes apply on the next page load."
        action={<span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full tabular-nums">{enabledCount} / {catalog.length} on</span>}
      >
        {loadingCatalog && catalog.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading catalog…</p>
        )}
        <div className="divide-y divide-border">
          {catalog.map((flag) => {
            const explicit = flag.key in form.featureFlags;
            const value = explicit ? form.featureFlags[flag.key] : flag.default;
            return (
              <div key={flag.key} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{flag.label}</p>
                    <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{flag.key}</code>
                    {!explicit && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">default: {flag.default ? "on" : "off"}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                </div>
                <ToggleSwitch checked={value} onChange={(v) => setFlag(flag.key, v)} />
              </div>
            );
          })}
        </div>
      </Card>
      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

// ─── API keys ───────────────────────────────────────────────────────────────

interface ApiKeyEntry {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: { name: string; email: string } | null;
}

function ApiKeysSection() {
  const [items, setItems] = useState<ApiKeyEntry[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ name: string; plaintext: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await axios.get<{ data: ApiKeyEntry[]; scopes: string[] }>("/api/settings/api-keys");
      setItems(r.data.data ?? []);
      setScopes(r.data.scopes ?? []);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function revoke(id: string, name: string) {
    if (!confirm(`Revoke "${name}"? Any service using this key will start getting 401s immediately.`)) return;
    try {
      await axios.post(`/api/settings/api-keys/${id}/revoke`, {});
      toast.success("Key revoked");
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Revoke failed");
    }
  }

  const active = items.filter((k) => !k.revokedAt);
  const revoked = items.filter((k) => k.revokedAt);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">API Keys</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Service tokens for portal apps and integrations. Tokens are hashed in the database — once revealed at creation they cannot be recovered.
            </p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">
            Create key
          </button>
        </div>

        {loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>
        )}

        {!loading && active.length === 0 && (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No API keys yet. Create one to authenticate the iOS portal, broker mobile app, public lead form, or any other integration.
          </p>
        )}

        <div className="divide-y divide-border">
          {active.map((k) => <ApiKeyRow key={k.id} k={k} onRevoke={() => revoke(k.id, k.name)} />)}
        </div>

        {revoked.length > 0 && (
          <details className="pt-4 border-t border-border">
            <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer">
              Revoked ({revoked.length})
            </summary>
            <div className="divide-y divide-border mt-2 opacity-60">
              {revoked.map((k) => <ApiKeyRow key={k.id} k={k} />)}
            </div>
          </details>
        )}
      </div>

      <CreateApiKeyModal
        open={createOpen}
        scopes={scopes}
        onClose={() => setCreateOpen(false)}
        onCreated={(name, plaintext) => {
          setCreateOpen(false);
          setRevealedKey({ name, plaintext });
          load();
        }}
      />

      <RevealKeyModal
        open={!!revealedKey}
        keyName={revealedKey?.name ?? ""}
        plaintext={revealedKey?.plaintext ?? ""}
        onClose={() => setRevealedKey(null)}
      />
    </div>
  );
}

function ApiKeyRow({ k, onRevoke }: { k: ApiKeyEntry; onRevoke?: () => void }) {
  const expired = k.expiresAt && new Date(k.expiresAt) < new Date();
  return (
    <div className="py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{k.name}</p>
          <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{k.prefix}…</code>
          {expired && !k.revokedAt && <span className="text-[10px] font-bold text-destructive bg-destructive-soft px-1.5 py-0.5 rounded uppercase">Expired</span>}
          {k.revokedAt && <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">Revoked</span>}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {k.scopes.map((s) => (
            <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-foreground">{s}</span>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Created {new Date(k.createdAt).toLocaleString()}{k.createdBy ? ` by ${k.createdBy.name}` : ""}
          {k.expiresAt ? ` · expires ${new Date(k.expiresAt).toLocaleDateString()}` : " · no expiry"}
          {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}` : " · never used"}
        </p>
      </div>
      {onRevoke && (
        <button onClick={onRevoke} className="px-3 py-1.5 text-xs font-semibold text-destructive border border-destructive/30 hover:bg-destructive-soft rounded-lg flex-shrink-0">
          Revoke
        </button>
      )}
    </div>
  );
}

function CreateApiKeyModal({ open, scopes, onClose, onCreated }: {
  open: boolean;
  scopes: string[];
  onClose: () => void;
  onCreated: (name: string, plaintext: string) => void;
}) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setName(""); setSelectedScopes([]); setExpiresAt(""); }
  }, [open]);

  function toggleScope(s: string) {
    setSelectedScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function submit() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (selectedScopes.length === 0) { toast.error("Pick at least one scope"); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), scopes: selectedScopes };
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const r = await axios.post("/api/settings/api-keys", body);
      onCreated(r.data.key.name, r.data.plaintext);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to create key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create API Key"
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg disabled:opacity-50">
            {busy ? "Creating…" : "Create key"}
          </button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className={lbl}>Name</label>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="iOS Buyer Portal — production" maxLength={120} autoFocus />
        </div>
        <div>
          <label className={lbl}>Scopes — at least one</label>
          <div className="grid grid-cols-2 gap-2">
            {scopes.map((s) => {
              const on = selectedScopes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScope(s)}
                  className={`px-3 py-2 text-xs font-mono rounded-lg border-2 text-left transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/30 text-foreground"}`}
                >
                  {on ? "✓ " : ""}{s}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className={lbl}>Expiry (optional)</label>
          <input type="date" className={inp} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
          <p className="text-[11px] text-muted-foreground mt-1">Leave blank for a non-expiring key.</p>
        </div>
        <div className="bg-warning-soft border border-warning/30 rounded-lg px-4 py-3 text-xs text-warning">
          <p className="font-semibold">Heads-up</p>
          <p className="leading-relaxed">After you create the key, the plaintext is shown <strong>once</strong>. Save it to your password manager or secrets store immediately — there's no way to retrieve it later.</p>
        </div>
      </div>
    </Modal>
  );
}

function RevealKeyModal({ open, keyName, plaintext, onClose }: {
  open: boolean;
  keyName: string;
  plaintext: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) setCopied(false); }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      toast.success("Copied to clipboard");
    } catch { toast.error("Copy failed — select and copy manually"); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save your new API key"
      size="lg"
      closeOnBackdrop={false}
      footer={
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">
          I've saved it — close
        </button>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div className="bg-warning-soft border border-warning/30 rounded-lg px-4 py-3 text-xs text-warning">
          <p className="font-semibold mb-1">This is the only time you'll see this token</p>
          <p className="leading-relaxed">After closing this dialog the plaintext is gone forever. Save it in a password manager or your service's secrets store.</p>
        </div>
        <div>
          <label className={lbl}>Key — {keyName}</label>
          <div className="flex gap-2">
            <input className={inp + " font-mono text-xs"} readOnly value={plaintext} onFocus={(e) => e.currentTarget.select()} />
            <button onClick={copy} className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg whitespace-nowrap">
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
