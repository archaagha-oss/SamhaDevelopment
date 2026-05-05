import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

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
}

type Tab = "info" | "deal" | "images";

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const sel = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";

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
    name: "", location: "", description: "", totalUnits: "", totalFloors: "",
    projectStatus: "ACTIVE", handoverDate: "", launchDate: "", startDate: "",
    completionStatus: "OFF_PLAN", purpose: "SALE", furnishing: "UNFURNISHED",
  });
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

  useEffect(() => {
    if (!projectId) return;
    axios.get(`/api/projects/${projectId}`).then((r) => {
      const p: Project = r.data;
      setInfo({
        name: p.name,
        location: p.location,
        description: p.description || "",
        totalUnits: p.totalUnits.toString(),
        totalFloors: p.totalFloors?.toString() || "",
        projectStatus: p.projectStatus,
        handoverDate: p.handoverDate ? p.handoverDate.split("T")[0] : "",
        launchDate: p.launchDate ? p.launchDate.split("T")[0] : "",
        startDate: p.startDate ? p.startDate.split("T")[0] : "",
        completionStatus: p.completionStatus || "OFF_PLAN",
        purpose: p.purpose || "SALE",
        furnishing: p.furnishing || "UNFURNISHED",
      });
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
        totalUnits: parseInt(info.totalUnits),
        totalFloors: info.totalFloors ? parseInt(info.totalFloors) : null,
        projectStatus: info.projectStatus,
        handoverDate: info.handoverDate,
        launchDate: info.launchDate || null,
        startDate: info.startDate || null,
        completionStatus: info.completionStatus,
        purpose: info.purpose,
        furnishing: info.furnishing,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "info",   label: "Project Info" },
    { key: "deal",   label: "Deal Settings" },
    { key: "images", label: "Tower Images" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <button onClick={() => navigate("/projects")} className="hover:text-slate-700">Projects</button>
            <span>/</span>
            <button onClick={() => navigate(`/projects/${projectId}`)} className="hover:text-slate-700">{info.name}</button>
            <span>/</span>
            <span className="text-slate-600 font-medium">Settings</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Project Settings</h1>
        </div>
        {/* Tabs */}
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

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Feedback */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex justify-between items-center">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">×</button>
          </div>
        )}
        {saved && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <p className="text-sm text-emerald-700">{saved}</p>
          </div>
        )}

        {/* ── TAB: PROJECT INFO ── */}
        {tab === "info" && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Basic Information</p>
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
                <div>
                  <label className={lbl}>Total Units</label>
                  <input type="number" className={inp} value={info.totalUnits} onChange={(e) => setInfo({ ...info, totalUnits: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Total Floors</label>
                  <input type="number" className={inp} value={info.totalFloors} onChange={(e) => setInfo({ ...info, totalFloors: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Property Classification</p>
              <div className="grid grid-cols-3 gap-4">
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
                  <label className={lbl}>Completion Status</label>
                  <select className={sel} value={info.completionStatus} onChange={(e) => setInfo({ ...info, completionStatus: e.target.value })}>
                    <option value="OFF_PLAN">Off-Plan</option>
                    <option value="UNDER_CONSTRUCTION">Under Construction</option>
                    <option value="READY">Ready</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status & Dates</p>
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
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveInfo}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Project Info"}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: DEAL SETTINGS ── */}
        {tab === "deal" && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fees & Rates</p>
              <p className="text-xs text-slate-400">Applied to new deals — does not retroactively change existing ones.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>DLD Fee (%)</label>
                  <input type="number" min="0" step="0.1" className={inp} value={config.dldPercent} onChange={(e) => setConfig({ ...config, dldPercent: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Dubai Land Dept fee on net price</p>
                </div>
                <div>
                  <label className={lbl}>Admin Fee (AED)</label>
                  <input type="number" min="0" className={inp} value={config.adminFee} onChange={(e) => setConfig({ ...config, adminFee: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Fixed fee per deal</p>
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
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Timelines</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Reservation Hold (days)</label>
                  <input type="number" min="1" className={inp} value={config.reservationDays} onChange={(e) => setConfig({ ...config, reservationDays: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Days a reservation holds the unit</p>
                </div>
                <div>
                  <label className={lbl}>OQOOD Deadline (days)</label>
                  <input type="number" min="1" className={inp} value={config.oqoodDays} onChange={(e) => setConfig({ ...config, oqoodDays: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Deadline for OQOOD registration</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Floor & Building Defaults</p>
              <p className="text-xs text-slate-400">Pre-fill values when bulk-creating units.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Units Per Floor</label>
                  <input type="number" min="1" max="100" className={inp} value={config.unitsPerFloor} onChange={(e) => setConfig({ ...config, unitsPerFloor: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Default units per floor in bulk creation</p>
                </div>
                <div>
                  <label className={lbl}>Total Floors</label>
                  <input type="number" min="1" max="200" className={inp} value={config.totalFloors} onChange={(e) => setConfig({ ...config, totalFloors: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Total number of floors in the building</p>
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
                  <label className={lbl}>Default Price (AED)</label>
                  <input type="number" min="1" className={inp} value={config.defaultPrice} onChange={(e) => setConfig({ ...config, defaultPrice: e.target.value })} placeholder="e.g. 1200000" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveConfig}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Deal Settings"}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: TOWER IMAGES ── */}
        {tab === "images" && (
          <div className="space-y-5">
            {/* Upload */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Upload Tower Image</p>
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
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
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-500">Uploading…</span>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl mb-2">🏢</p>
                    <p className="text-sm font-medium text-slate-700 mb-1">Drop image here or click to select</p>
                    <p className="text-xs text-slate-400">JPEG, PNG, or WebP up to 15MB</p>
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
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <p className="text-2xl mb-2">🏢</p>
                <p className="text-sm text-slate-400">No tower images uploaded yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Tower Images <span className="ml-1 text-slate-400">({images.length})</span>
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {images.map((img) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={img.url}
                        alt={img.caption || "Tower"}
                        className="w-full h-44 object-cover"
                      />
                      {img.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1.5">
                          {img.caption}
                        </div>
                      )}
                      <button
                        onClick={() => handleDelete(img.id)}
                        disabled={deletingId === img.id}
                        className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
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
      </div>
    </div>
  );
}
