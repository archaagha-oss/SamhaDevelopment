import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { phasesApi } from "../services/phase2ApiService";
const STAGE_COLORS = {
    INTERNAL: "bg-gray-200 text-gray-800",
    BROKER_PREVIEW: "bg-amber-100 text-amber-800",
    PUBLIC: "bg-green-100 text-green-800",
};
export default function PhasesPage() {
    const { projectId } = useParams();
    const [phases, setPhases] = useState([]);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        if (!projectId)
            return;
        setLoading(true);
        try {
            const data = await phasesApi.listForProject(projectId);
            setPhases(data);
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load();
    }, [projectId]);
    const advance = async (phase) => {
        const nextStage = phase.releaseStage === "INTERNAL"
            ? "BROKER_PREVIEW"
            : phase.releaseStage === "BROKER_PREVIEW"
                ? "PUBLIC"
                : null;
        if (!nextStage) {
            toast.info("Phase is already in PUBLIC release.");
            return;
        }
        try {
            await phasesApi.changeReleaseStage(phase.id, nextStage);
            toast.success(`Phase advanced to ${nextStage}`);
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    if (!projectId)
        return _jsx("div", { className: "p-6", children: "Project ID required." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsx("h1", { className: "text-2xl font-semibold", children: "Project Phases" }) }), loading ? (_jsx("p", { className: "text-gray-500", children: "Loading\u2026" })) : phases.length === 0 ? (_jsx("p", { className: "text-gray-500", children: "No phases configured for this project." })) : (_jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase text-gray-500 border-b", children: [_jsx("th", { className: "py-2", children: "Phase" }), _jsx("th", { children: "Code" }), _jsx("th", { children: "Floors" }), _jsx("th", { children: "Units" }), _jsx("th", { children: "Release Stage" }), _jsx("th", { children: "Public Launch" }), _jsx("th", {})] }) }), _jsx("tbody", { children: phases.map((p) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-2", children: p.name }), _jsx("td", { children: p.code ?? "—" }), _jsx("td", { children: p.floorFrom != null ? `${p.floorFrom}-${p.floorTo ?? "?"}` : "—" }), _jsx("td", { children: p._count?.units ?? "—" }), _jsx("td", { children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${STAGE_COLORS[p.releaseStage]}`, children: p.releaseStage }) }), _jsx("td", { children: p.publicLaunchDate ? new Date(p.publicLaunchDate).toLocaleDateString() : "—" }), _jsx("td", { children: p.releaseStage !== "PUBLIC" && (_jsx("button", { className: "text-blue-600 hover:underline text-sm", onClick: () => advance(p), children: "Advance Stage \u2192" })) })] }, p.id))) })] }))] }));
}
