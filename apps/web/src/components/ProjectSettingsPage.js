import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";
const sel = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400";
export default function ProjectSettingsPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [tab, setTab] = useState("info");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(null);
    const [error, setError] = useState(null);
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
    const [images, setImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [caption, setCaption] = useState("");
    const [deletingId, setDeletingId] = useState(null);
    useEffect(() => {
        if (!projectId)
            return;
        axios.get(`/api/projects/${projectId}`).then((r) => {
            const p = r.data;
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
        setSaving(true);
        setSaved(null);
        setError(null);
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
        }
        catch (e) {
            setError(e.response?.data?.error || "Failed to save");
        }
        finally {
            setSaving(false);
        }
    };
    const saveConfig = async () => {
        setSaving(true);
        setSaved(null);
        setError(null);
        try {
            await axios.patch(`/api/projects/${projectId}/config`, {
                dldPercent: parseFloat(config.dldPercent),
                adminFee: parseFloat(config.adminFee),
                reservationDays: parseInt(config.reservationDays),
                oqoodDays: parseInt(config.oqoodDays),
                vatPercent: parseFloat(config.vatPercent),
                agencyFeePercent: parseFloat(config.agencyFeePercent),
                unitsPerFloor: parseInt(config.unitsPerFloor),
                ...(config.totalFloors && { totalFloors: parseInt(config.totalFloors) }),
                ...(config.defaultUnitType && { defaultUnitType: config.defaultUnitType }),
                ...(config.defaultArea && { defaultArea: parseFloat(config.defaultArea) }),
                ...(config.defaultView && { defaultView: config.defaultView }),
                ...(config.defaultPrice && { defaultPrice: parseFloat(config.defaultPrice) }),
            });
            setSaved("Deal settings saved.");
        }
        catch (e) {
            setError(e.response?.data?.error || "Failed to save");
        }
        finally {
            setSaving(false);
        }
    };
    const handleUpload = async (file) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            if (caption)
                fd.append("caption", caption);
            const res = await axios.post(`/api/projects/${projectId}/images`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setImages((prev) => [...prev, res.data]);
            setCaption("");
            if (fileInputRef.current)
                fileInputRef.current.value = "";
        }
        catch {
            setError("Failed to upload image");
        }
        finally {
            setUploading(false);
        }
    };
    const handleDelete = async (imageId) => {
        setDeletingId(imageId);
        try {
            await axios.delete(`/api/projects/${projectId}/images/${imageId}`);
            setImages((prev) => prev.filter((i) => i.id !== imageId));
        }
        catch {
            setError("Failed to delete image");
        }
        finally {
            setDeletingId(null);
        }
    };
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    const tabs = [
        { key: "info", label: "Project Info" },
        { key: "deal", label: "Deal Settings" },
        { key: "images", label: "Tower Images" },
    ];
    return (_jsxs("div", { className: "min-h-screen bg-slate-50", children: [_jsxs("div", { className: "bg-white border-b border-slate-200 sticky top-0 z-10", children: [_jsxs("div", { className: "max-w-3xl mx-auto px-6 py-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-400 mb-2", children: [_jsx("button", { onClick: () => navigate("/projects"), className: "hover:text-slate-700", children: "Projects" }), _jsx("span", { children: "/" }), _jsx("button", { onClick: () => navigate(`/projects/${projectId}`), className: "hover:text-slate-700", children: info.name }), _jsx("span", { children: "/" }), _jsx("span", { className: "text-slate-600 font-medium", children: "Settings" })] }), _jsx("h1", { className: "text-xl font-bold text-slate-900", children: "Project Settings" })] }), _jsx("div", { className: "max-w-3xl mx-auto px-6 flex gap-1", children: tabs.map((t) => (_jsx("button", { onClick: () => { setTab(t.key); setSaved(null); setError(null); }, className: `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-slate-500 hover:text-slate-800"}`, children: t.label }, t.key))) })] }), _jsxs("div", { className: "max-w-3xl mx-auto px-6 py-6", children: [error && (_jsxs("div", { className: "mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex justify-between items-center", children: [_jsx("p", { className: "text-sm text-red-700", children: error }), _jsx("button", { onClick: () => setError(null), className: "text-red-400 hover:text-red-600 ml-4", children: "\u00D7" })] })), saved && (_jsx("div", { className: "mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3", children: _jsx("p", { className: "text-sm text-emerald-700", children: saved }) })), tab === "info" && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Basic Information" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: lbl, children: "Project Name" }), _jsx("input", { className: inp, value: info.name, onChange: (e) => setInfo({ ...info, name: e.target.value }) })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: lbl, children: "Location" }), _jsx("input", { className: inp, value: info.location, onChange: (e) => setInfo({ ...info, location: e.target.value }) })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: lbl, children: "Description" }), _jsx("textarea", { className: inp, rows: 3, value: info.description, onChange: (e) => setInfo({ ...info, description: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Total Units" }), _jsx("input", { type: "number", className: inp, value: info.totalUnits, onChange: (e) => setInfo({ ...info, totalUnits: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Total Floors" }), _jsx("input", { type: "number", className: inp, value: info.totalFloors, onChange: (e) => setInfo({ ...info, totalFloors: e.target.value }) })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Property Classification" }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Purpose" }), _jsxs("select", { className: sel, value: info.purpose, onChange: (e) => setInfo({ ...info, purpose: e.target.value }), children: [_jsx("option", { value: "SALE", children: "Sale" }), _jsx("option", { value: "RENT", children: "Rent" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Furnishing" }), _jsxs("select", { className: sel, value: info.furnishing, onChange: (e) => setInfo({ ...info, furnishing: e.target.value }), children: [_jsx("option", { value: "UNFURNISHED", children: "Unfurnished" }), _jsx("option", { value: "SEMI_FURNISHED", children: "Semi Furnished" }), _jsx("option", { value: "FURNISHED", children: "Furnished" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Completion Status" }), _jsxs("select", { className: sel, value: info.completionStatus, onChange: (e) => setInfo({ ...info, completionStatus: e.target.value }), children: [_jsx("option", { value: "OFF_PLAN", children: "Off-Plan" }), _jsx("option", { value: "UNDER_CONSTRUCTION", children: "Under Construction" }), _jsx("option", { value: "READY", children: "Ready" })] })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Status & Dates" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Project Status" }), _jsxs("select", { className: sel, value: info.projectStatus, onChange: (e) => setInfo({ ...info, projectStatus: e.target.value }), children: [_jsx("option", { value: "ACTIVE", children: "Active" }), _jsx("option", { value: "ON_HOLD", children: "On Hold" }), _jsx("option", { value: "COMPLETED", children: "Completed" }), _jsx("option", { value: "CANCELLED", children: "Cancelled" })] })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Handover Date" }), _jsx("input", { type: "date", className: inp, value: info.handoverDate, onChange: (e) => setInfo({ ...info, handoverDate: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Launch Date" }), _jsx("input", { type: "date", className: inp, value: info.launchDate, onChange: (e) => setInfo({ ...info, launchDate: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Start Date" }), _jsx("input", { type: "date", className: inp, value: info.startDate, onChange: (e) => setInfo({ ...info, startDate: e.target.value }) })] })] })] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: saveInfo, disabled: saving, className: "px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50", children: saving ? "Saving…" : "Save Project Info" }) })] })), tab === "deal" && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Fees & Rates" }), _jsx("p", { className: "text-xs text-slate-400", children: "Applied to new deals \u2014 does not retroactively change existing ones." }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "DLD Fee (%)" }), _jsx("input", { type: "number", min: "0", step: "0.1", className: inp, value: config.dldPercent, onChange: (e) => setConfig({ ...config, dldPercent: e.target.value }) }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Dubai Land Dept fee on net price" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Admin Fee (AED)" }), _jsx("input", { type: "number", min: "0", className: inp, value: config.adminFee, onChange: (e) => setConfig({ ...config, adminFee: e.target.value }) }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Fixed fee per deal" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "VAT (%)" }), _jsx("input", { type: "number", min: "0", step: "0.1", className: inp, value: config.vatPercent, onChange: (e) => setConfig({ ...config, vatPercent: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Agency Fee (%)" }), _jsx("input", { type: "number", min: "0", step: "0.1", className: inp, value: config.agencyFeePercent, onChange: (e) => setConfig({ ...config, agencyFeePercent: e.target.value }) })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Timelines" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Reservation Hold (days)" }), _jsx("input", { type: "number", min: "1", className: inp, value: config.reservationDays, onChange: (e) => setConfig({ ...config, reservationDays: e.target.value }) }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Days a reservation holds the unit" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "OQOOD Deadline (days)" }), _jsx("input", { type: "number", min: "1", className: inp, value: config.oqoodDays, onChange: (e) => setConfig({ ...config, oqoodDays: e.target.value }) }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Deadline for OQOOD registration" })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6 space-y-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Floor & Building Defaults" }), _jsx("p", { className: "text-xs text-slate-400", children: "Pre-fill values when bulk-creating units." }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Units Per Floor" }), _jsx("input", { type: "number", min: "1", max: "100", className: inp, value: config.unitsPerFloor, onChange: (e) => setConfig({ ...config, unitsPerFloor: e.target.value }) }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Default units per floor in bulk creation" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Total Floors" }), _jsx("input", { type: "number", min: "1", max: "200", className: inp, value: config.totalFloors, onChange: (e) => setConfig({ ...config, totalFloors: e.target.value }) }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Total number of floors in the building" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: lbl, children: "Default Unit Type" }), _jsx("select", { className: sel, value: config.defaultUnitType, onChange: (e) => setConfig({ ...config, defaultUnitType: e.target.value }), children: ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"].map((t) => (_jsx("option", { value: t, children: t.replace(/_/g, " ") }, t))) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Default View" }), _jsx("select", { className: sel, value: config.defaultView, onChange: (e) => setConfig({ ...config, defaultView: e.target.value }), children: ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"].map((v) => (_jsx("option", { value: v, children: v }, v))) })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Default Area (sqm)" }), _jsx("input", { type: "number", min: "1", step: "0.1", className: inp, value: config.defaultArea, onChange: (e) => setConfig({ ...config, defaultArea: e.target.value }), placeholder: "e.g. 85" })] }), _jsxs("div", { children: [_jsx("label", { className: lbl, children: "Default Price (AED)" }), _jsx("input", { type: "number", min: "1", className: inp, value: config.defaultPrice, onChange: (e) => setConfig({ ...config, defaultPrice: e.target.value }), placeholder: "e.g. 1200000" })] })] })] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: saveConfig, disabled: saving, className: "px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50", children: saving ? "Saving…" : "Save Deal Settings" }) })] })), tab === "images" && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4", children: "Upload Tower Image" }), _jsx("div", { className: "border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer", onClick: () => fileInputRef.current?.click(), onDrop: (e) => {
                                            e.preventDefault();
                                            const file = e.dataTransfer.files[0];
                                            if (file)
                                                handleUpload(file);
                                        }, onDragOver: (e) => e.preventDefault(), children: uploading ? (_jsxs("div", { className: "flex items-center justify-center gap-2", children: [_jsx("div", { className: "w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }), _jsx("span", { className: "text-sm text-slate-500", children: "Uploading\u2026" })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-3xl mb-2", children: "\uD83C\uDFE2" }), _jsx("p", { className: "text-sm font-medium text-slate-700 mb-1", children: "Drop image here or click to select" }), _jsx("p", { className: "text-xs text-slate-400", children: "JPEG, PNG, or WebP up to 15MB" })] })) }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => { const f = e.target.files?.[0]; if (f)
                                            handleUpload(f); } }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: lbl, children: "Caption (optional)" }), _jsx("input", { type: "text", value: caption, onChange: (e) => setCaption(e.target.value), placeholder: "e.g. North elevation, Lobby entrance...", className: inp })] })] }), images.length === 0 ? (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-10 text-center", children: [_jsx("p", { className: "text-2xl mb-2", children: "\uD83C\uDFE2" }), _jsx("p", { className: "text-sm text-slate-400", children: "No tower images uploaded yet" })] })) : (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-6", children: [_jsxs("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4", children: ["Tower Images ", _jsxs("span", { className: "ml-1 text-slate-400", children: ["(", images.length, ")"] })] }), _jsx("div", { className: "grid grid-cols-3 gap-4", children: images.map((img) => (_jsxs("div", { className: "relative group rounded-xl overflow-hidden border border-slate-200", children: [_jsx("img", { src: img.url, alt: img.caption || "Tower", className: "w-full h-44 object-cover" }), img.caption && (_jsx("div", { className: "absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1.5", children: img.caption })), _jsx("button", { onClick: () => handleDelete(img.id), disabled: deletingId === img.id, className: "absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50", children: deletingId === img.id ? "…" : "×" })] }, img.id))) })] }))] }))] })] }));
}
