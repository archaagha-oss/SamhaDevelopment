import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Building2 } from "lucide-react";
import ProjectDocumentsTab from "./ProjectDocumentsTab";
import { PageContainer, PageHeader } from "./layout";

interface ProjectImage { id: string; url: string; caption?: string; sortOrder: number; }
interface ProjectConfig {
  dldPercent: number; adminFee: number; reservationDays: number;
  oqoodDays: number; vatPercent: number; agencyFeePercent: number;
  unitsPerFloor: number; totalFloors?: number;
  defaultUnitType?: string; defaultArea?: number; defaultView?: string; defaultPrice?: number;
}
interface Project {
  id: string; name: string; location: string; description?: string;
  totalUnits: number; totalFloors?: number;
  projectStatus: string; handoverDate: string; launchDate?: string; startDate?: string;
  completionStatus: string; purpose: string; furnishing: string;
  images: ProjectImage[]; config?: ProjectConfig;
  units?: Array<{ id: string }>;
}

type Tab = "info" | "deal" | "images" | "documents";

// Token-driven form primitives — see design-system/MASTER.md
const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:border-primary";
const lbl = "block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1";
const sel = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:border-primary";

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [info, setInfo] = useState({
    name: "", location: "", description: "", totalFloors: "",
    projectStatus: "ACTIVE", handoverDate: "", launchDate: "", startDate: "",
    completionStatus: "OFF_PLAN", purpose: "SALE", furnishing: "UNFURNISHED",
    // Arabic legal copies — fed into the bilingual SPA generator. Blank is
    // OK; the SPA preview surfaces missingArabic[] so the operator knows
    // which fields still need translation before finalizing the document.
    nameAr: "", locationAr: "", developerNameAr: "", developerAddressAr: "",
  });
  const [actualUnits, setActualUnits] = useState(0);
  const [config, setConfig] = useState({
    dldPercent: "4", adminFee: "5000", reservationDays: "7",
    oqoodDays: "90", vatPercent: "0", agencyFeePercent: "2",
    unitsPerFloor: "8", totalFloors: "",
    defaultUnitType: "STUDIO", defaultArea: "", defaultView: "GARDEN", defaultPrice: "",
  });
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deletingProject, setDeletingProject] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    axios.get(`/api/projects/${projectId}`).then((r) => {
      const p: Project = r.data;
      setInfo({
        name: p.name,
        location: p.location,
        description: p.description || "",
        totalFloors: p.totalFloors?.toString() || "",
        projectStatus: p.projectStatus,
        handoverDate: p.handoverDate ? p.handoverDate.split("T")[0] : "",
        launchDate: p.launchDate ? p.launchDate.split("T")[0] : "",
        startDate: p.startDate ? p.startDate.split("T")[0] : "",
        completionStatus: p.completionStatus || "OFF_PLAN",
        purpose: p.purpose || "SALE",
        furnishing: p.furnishing || "UNFURNISHED",
        nameAr:             (p as any).nameAr             ?? "",
        locationAr:         (p as any).locationAr         ?? "",
        developerNameAr:    (p as any).developerNameAr    ?? "",
        developerAddressAr: (p as any).developerAddressAr ?? "",
      });
      setActualUnits(p.units?.length ?? 0);
      setImages(p.images || []);
      if (p.config) {
        setConfig({
          dldPercent: p.config.dldPercent.toString(),
          adminFee: p.config.adminFee.toString(),
          reservationDays: p.config.reservationDays.toString(),
          oqoodDays: p.config.oqoodDays.toString(),
          vatPercent: p.config.vatPercent.toString(),
          agencyFeePercent: p.config.agencyFeePercent.toString(),
          unitsPerFloor: p.config.unitsPerFloor.toString(),
          totalFloors: p.config.totalFloors?.toString() ?? "",
          defaultUnitType: p.config.defaultUnitType ?? "STUDIO",
          defaultArea: p.config.defaultArea?.toString() ?? "",
          defaultView: p.config.defaultView ?? "GARDEN",
          defaultPrice: p.config.defaultPrice?.toString() ?? "",
        });
      }
    }).catch(() => setError("Failed to load project")).finally(() => setLoading(false));
  }, [projectId]);

  const saveInfo = async () => {
    setSaving(true); setSaved(null); setError(null);
    try {
      await axios.patch(`/api/projects/${projectId}`, {
        name: info.name, location: info.location,
        description: info.description || null,
        totalFloors: info.totalFloors ? parseInt(info.totalFloors) : null,
        projectStatus: info.projectStatus,
        handoverDate: info.handoverDate,
        launchDate: info.launchDate || null,
        startDate: info.startDate || null,
        completionStatus: info.completionStatus,
        purpose: info.purpose,
        furnishing: info.furnishing,
        // Empty strings collapse to null so a blank field doesn't get stored
        // as " " and bypass the bilingual SPA's missingArabic detector.
        nameAr:             info.nameAr             || null,
        locationAr:         info.locationAr         || null,
        developerNameAr:    info.developerNameAr    || null,
        developerAddressAr: info.developerAddressAr || null,
      });
      setSaved("Project info saved.");
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  const saveConfig = async () => {
    setSaving(true); setSaved(null); setError(null);
    try {
      await axios.patch(`/api/projects/${projectId}/config`, {
        dldPercent: parseFloat(config.dldPercent),
        adminFee: parseFloat(config.adminFee),
        reservationDays: parseInt(config.reservationDays),
        oqoodDays: parseInt(config.oqoodDays),
        vatPercent: parseFloat(config.vatPercent),
        agencyFeePercent: parseFloat(config.agencyFeePercent),
        unitsPerFloor: parseInt(config.unitsPerFloor),
        ...(config.totalFloors     && { totalFloors:     parseInt(config.totalFloors) }),
        ...(config.defaultUnitType && { defaultUnitType: config.defaultUnitType }),
        ...(config.defaultArea     && { defaultArea:     parseFloat(config.defaultArea) }),
        ...(config.defaultView     && { defaultView:     config.defaultView }),
        ...(config.defaultPrice    && { defaultPrice:    parseFloat(config.defaultPrice) }),
      });
      setSaved("Deal settings saved.");
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (caption) fd.append("caption", caption);
      const res = await axios.post(`/api/projects/${projectId}/images`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImages((prev) => [...prev, res.data]);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch { setError("Failed to upload image"); }
    finally { setUploading(false); }
  };

  const handleDelete = async (imageId: string) => {
    setDeletingId(imageId);
    try {
      await axios.delete(`/api/projects/${projectId}/images/${imageId}`);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    } catch { setError("Failed to delete image"); }
    finally { setDeletingId(null); }
  };

  const handleDeleteProject = async () => {
    setDeletingProject(true);
    setError(null);
    try {
      await axios.delete(`/api/projects/${projectId}`);
      navigate("/projects");
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to delete project");
      setShowDeleteConfirm(false);
      setDeleteText("");
    } finally {
      setDeletingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "info",      label: "Details" },
    { key: "deal",      label: "Pricing" },
    { key: "images",    label: "Images" },
    { key: "documents", label: "Documents" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[
          { label: "Projects", path: "/projects" },
          { label: info.name || "Project", path: `/projects/${projectId}` },
          { label: "Settings" },
        ]}
        title="Settings"
        subtitle={info.name}
        tabs={(
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Settings sections">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setSaved(null); setError(null); }}
                  role="tab"
                  aria-selected={active}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    active ? "border-primary/40 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      />

      <div className="flex-1 overflow-auto">
      <PageContainer width="default" padding="default">
        {/* Feedback */}
        {error && (
          <div className="mb-4 bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-3 flex justify-between items-center">
            <p className="text-sm text-destructive">{error}</p>
            <button onClick={() => setError(null)} className="text-destructive hover:text-destructive ml-4">×</button>
          </div>
        )}
        {saved && (
          <div className="mb-4 bg-success-soft border border-success/30 rounded-lg px-4 py-3">
            <p className="text-sm text-success">{saved}</p>
          </div>
        )}

        {/* ── TAB: DETAILS ── */}
        {tab === "info" && (
          <div className="space-y-5">
            {/* § General */}
            <section className="bg-card rounded-lg border border-border p-6 space-y-4">
              <header>
                <h2 className="text-sm font-semibold text-foreground">General</h2>
                <p className="text-xs text-muted-foreground">Identity and description shown to teams and clients.</p>
              </header>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Project Name</label>
                  <input className={inp} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Location</label>
                  <input className={inp} value={info.location} onChange={(e) => setInfo({ ...info, location: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Description</label>
                  <textarea className={inp} rows={3} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
                </div>
              </div>
            </section>

            {/* § Arabic / SPA particulars — used by the bilingual SPA renderer.
                Leave blank for projects that won't generate Arabic-side SPAs. */}
            <details className="bg-card rounded-lg border border-border overflow-hidden">
              <summary className="px-6 py-4 cursor-pointer select-none">
                <span className="text-sm font-semibold text-foreground">Arabic / SPA particulars</span>
                <p className="text-xs text-muted-foreground mt-1">Right-to-left Arabic copies of the project + developer identity. Used only by the bilingual SPA template.</p>
              </summary>
              <div className="px-6 pb-6 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Project name (Arabic)</label>
                  <input
                    className={inp}
                    dir="rtl"
                    lang="ar"
                    value={info.nameAr}
                    onChange={(e) => setInfo({ ...info, nameAr: e.target.value })}
                    placeholder="اسم المشروع"
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Location (Arabic)</label>
                  <input
                    className={inp}
                    dir="rtl"
                    lang="ar"
                    value={info.locationAr}
                    onChange={(e) => setInfo({ ...info, locationAr: e.target.value })}
                    placeholder="الموقع"
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Developer name (Arabic)</label>
                  <input
                    className={inp}
                    dir="rtl"
                    lang="ar"
                    value={info.developerNameAr}
                    onChange={(e) => setInfo({ ...info, developerNameAr: e.target.value })}
                    placeholder="اسم المطور"
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Developer address (Arabic)</label>
                  <input
                    className={inp}
                    dir="rtl"
                    lang="ar"
                    value={info.developerAddressAr}
                    onChange={(e) => setInfo({ ...info, developerAddressAr: e.target.value })}
                    placeholder="عنوان المطور"
                  />
                </div>
              </div>
            </details>

            {/* § Schedule */}
            <section className="bg-card rounded-lg border border-border p-6 space-y-4">
              <header>
                <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
                <p className="text-xs text-muted-foreground">Project lifecycle status and key dates.</p>
              </header>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Project Status</label>
                  <select className={sel} value={info.projectStatus} onChange={(e) => setInfo({ ...info, projectStatus: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Completion Status</label>
                  <select className={sel} value={info.completionStatus} onChange={(e) => setInfo({ ...info, completionStatus: e.target.value })}>
                    <option value="OFF_PLAN">Off-Plan</option>
                    <option value="UNDER_CONSTRUCTION">Under Construction</option>
                    <option value="READY">Ready</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Handover Date</label>
                  <input type="date" className={inp} value={info.handoverDate} onChange={(e) => setInfo({ ...info, handoverDate: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Launch Date</label>
                  <input type="date" className={inp} value={info.launchDate} onChange={(e) => setInfo({ ...info, launchDate: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Start Date</label>
                  <input type="date" className={inp} value={info.startDate} onChange={(e) => setInfo({ ...info, startDate: e.target.value })} />
                </div>
              </div>
            </section>

            {/* § Property */}
            <section className="bg-card rounded-lg border border-border p-6 space-y-4">
              <header>
                <h2 className="text-sm font-semibold text-foreground">Property</h2>
                <p className="text-xs text-muted-foreground">Type, layout, and capacity.</p>
              </header>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Purpose</label>
                  <select className={sel} value={info.purpose} onChange={(e) => setInfo({ ...info, purpose: e.target.value })}>
                    <option value="SALE">Sale</option>
                    <option value="RENT">Rent</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Furnishing</label>
                  <select className={sel} value={info.furnishing} onChange={(e) => setInfo({ ...info, furnishing: e.target.value })}>
                    <option value="UNFURNISHED">Unfurnished</option>
                    <option value="SEMI_FURNISHED">Semi Furnished</option>
                    <option value="FURNISHED">Furnished</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Total Units</label>
                  <input
                    type="number"
                    className={`${inp} bg-muted/50 text-foreground cursor-not-allowed`}
                    value={actualUnits}
                    readOnly
                    aria-readonly
                  />
                  <p className="text-xs text-muted-foreground mt-1">Auto-calculated from units in this project.</p>
                </div>
                <div>
                  <label className={lbl}>Total Floors</label>
                  <input type="number" className={inp} value={info.totalFloors} onChange={(e) => setInfo({ ...info, totalFloors: e.target.value })} />
                </div>
              </div>
            </section>

            {/* Save */}
            <div className="flex justify-end">
              <button
                onClick={saveInfo}
                disabled={saving}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            {/* § Danger Zone — visually separated by divider, distinct class of action */}
            <div className="pt-6 mt-8 border-t border-border" />
            <section className="bg-card rounded-lg border border-destructive/30 p-6">
              <header className="mb-4">
                <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
                <p className="text-xs text-muted-foreground">Destructive actions. These cannot be undone.</p>
              </header>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Delete this project</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Project must have no units before it can be deleted.</p>
                </div>
                <button
                  onClick={() => { setShowDeleteConfirm(true); setDeleteText(""); }}
                  className="px-4 py-2 bg-destructive-soft hover:bg-destructive-soft border border-destructive/30 text-destructive text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Delete Project
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ── TAB: PRICING ── */}
        {tab === "deal" && (
          <div className="space-y-5">
            {/* § Fees & Rates */}
            <section className="bg-card rounded-lg border border-border p-6 space-y-4">
              <header>
                <h2 className="text-sm font-semibold text-foreground">Fees & Rates</h2>
                <p className="text-xs text-muted-foreground">Applied to new deals — does not retroactively change existing ones.</p>
              </header>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>DLD Fee (%)</label>
                  <input type="number" min="0" step="0.1" className={inp} value={config.dldPercent} onChange={(e) => setConfig({ ...config, dldPercent: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Dubai Land Dept fee on net price</p>
                </div>
                <div>
                  <label className={lbl}>Admin Fee</label>
                  <input type="number" min="0" className={inp} value={config.adminFee} onChange={(e) => setConfig({ ...config, adminFee: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Fixed fee per deal</p>
                </div>
                <div>
                  <label className={lbl}>VAT (%)</label>
                  <input type="number" min="0" step="0.1" className={inp} value={config.vatPercent} onChange={(e) => setConfig({ ...config, vatPercent: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Agency Fee (%)</label>
                  <input type="number" min="0" step="0.1" className={inp} value={config.agencyFeePercent} onChange={(e) => setConfig({ ...config, agencyFeePercent: e.target.value })} />
                </div>
              </div>
            </section>

            {/* § Timing */}
            <section className="bg-card rounded-lg border border-border p-6 space-y-4">
              <header>
                <h2 className="text-sm font-semibold text-foreground">Timing</h2>
                <p className="text-xs text-muted-foreground">Reservation hold and registration deadlines.</p>
              </header>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Reservation Hold (days)</label>
                  <input type="number" min="1" className={inp} value={config.reservationDays} onChange={(e) => setConfig({ ...config, reservationDays: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Days a reservation holds the unit</p>
                </div>
                <div>
                  <label className={lbl}>OQOOD Deadline (days)</label>
                  <input type="number" min="1" className={inp} value={config.oqoodDays} onChange={(e) => setConfig({ ...config, oqoodDays: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Deadline for OQOOD registration</p>
                </div>
              </div>
            </section>

            {/* § Defaults */}
            <section className="bg-card rounded-lg border border-border p-6 space-y-4">
              <header>
                <h2 className="text-sm font-semibold text-foreground">Defaults</h2>
                <p className="text-xs text-muted-foreground">Pre-fill values when bulk-creating units.</p>
              </header>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Units Per Floor</label>
                  <input type="number" min="1" max="100" className={inp} value={config.unitsPerFloor} onChange={(e) => setConfig({ ...config, unitsPerFloor: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Default units per floor in bulk creation</p>
                </div>
                <div>
                  <label className={lbl}>Total Floors</label>
                  <input type="number" min="1" max="200" className={inp} value={config.totalFloors} onChange={(e) => setConfig({ ...config, totalFloors: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Total number of floors in the building</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Default Unit Type</label>
                  <select className={sel} value={config.defaultUnitType} onChange={(e) => setConfig({ ...config, defaultUnitType: e.target.value })}>
                    {["STUDIO","ONE_BR","TWO_BR","THREE_BR","FOUR_BR","COMMERCIAL"].map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Default View</label>
                  <select className={sel} value={config.defaultView} onChange={(e) => setConfig({ ...config, defaultView: e.target.value })}>
                    {["SEA","GARDEN","STREET","BACK","SIDE","AMENITIES"].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Default Area (sqm)</label>
                  <input type="number" min="1" step="0.1" className={inp} value={config.defaultArea} onChange={(e) => setConfig({ ...config, defaultArea: e.target.value })} placeholder="e.g. 85" />
                </div>
                <div>
                  <label className={lbl}>Default Price</label>
                  <input type="number" min="1" className={inp} value={config.defaultPrice} onChange={(e) => setConfig({ ...config, defaultPrice: e.target.value })} placeholder="e.g. 1200000" />
                </div>
              </div>
            </section>

            {/* Save */}
            <div className="flex justify-end">
              <button
                onClick={saveConfig}
                disabled={saving}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: PROJECT IMAGES ── */}
        {tab === "images" && (
          <div className="space-y-5">
            {/* Upload */}
            <div className="bg-card rounded-lg border border-border p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Upload Project Image</p>
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 hover:bg-info-soft transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleUpload(file);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">Uploading…</span>
                  </div>
                ) : (
                  <>
                    <Building2 className="size-8 mb-2 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground mb-1">Drop image here or click to select</p>
                    <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP up to 15MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
              <div className="mt-3">
                <label className={lbl}>Caption (optional)</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g. North elevation, Lobby entrance..."
                  className={inp}
                />
              </div>
            </div>

            {/* Gallery */}
            {images.length === 0 ? (
              <div className="bg-card rounded-lg border border-border p-10 text-center">
                <Building2 className="size-6 mb-2 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No tower images uploaded yet</p>
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-border p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Project Images <span className="ml-1 text-muted-foreground">({images.length})</span>
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {images.map((img) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border">
                      <img
                        src={img.url}
                        alt={img.caption || "Tower"}
                        className="w-full h-44 object-cover"
                      />
                      {img.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-foreground/60 text-background text-xs px-2 py-1.5">
                          {img.caption}
                        </div>
                      )}
                      <button
                        onClick={() => handleDelete(img.id)}
                        disabled={deletingId === img.id}
                        className="absolute top-2 right-2 w-7 h-7 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {deletingId === img.id ? "…" : "×"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: DOCUMENTS ── */}
        {tab === "documents" && projectId && (
          <ProjectDocumentsTab projectId={projectId} />
        )}
      </PageContainer>
      </div>

      {/* Delete Project Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-bold text-destructive">Delete Project</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-foreground">
                This will permanently delete <span className="font-semibold">{info.name}</span> and
                all its configuration. Project images, documents, deal settings, specifications, and bank accounts
                will be removed. This cannot be undone.
              </p>
              <div>
                <label className={lbl}>
                  Type <span className="font-mono text-destructive">{info.name}</span> to confirm
                </label>
                <input
                  className={inp}
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder={info.name}
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteText(""); }}
                disabled={deletingProject}
                className="flex-1 py-2.5 bg-muted text-foreground font-medium rounded-lg hover:bg-muted/80 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deleteText !== info.name || deletingProject}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground font-semibold rounded-lg hover:bg-destructive/90 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deletingProject ? "Deleting…" : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
