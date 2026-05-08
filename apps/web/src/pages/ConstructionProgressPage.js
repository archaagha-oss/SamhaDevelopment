import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { constructionApi } from "../services/phase2ApiService";
const STAGES = [
    "EXCAVATION",
    "FOUNDATION",
    "STRUCTURE",
    "ENCLOSURE",
    "MEP",
    "FINISHES",
    "HANDOVER_READY",
    "COMPLETED",
];
export default function ConstructionProgressPage() {
    const { projectId } = useParams();
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        if (!projectId)
            return;
        setLoading(true);
        try {
            const data = await constructionApi.listForProject(projectId);
            setMilestones(data);
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
    const updatePct = async (m, value) => {
        if (Number.isNaN(value) || value < 0 || value > 100) {
            toast.error("Percent must be between 0 and 100");
            return;
        }
        try {
            const result = await constructionApi.updatePercent(m.id, value);
            const fired = result.paymentsTriggered?.length ?? 0;
            toast.success(`Updated to ${value}%${fired ? ` — ${fired} payment(s) fired` : ""}`);
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    if (!projectId)
        return _jsx("div", { className: "p-6", children: "Project ID required." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Construction Progress" }), _jsxs("p", { className: "text-sm text-gray-500", children: ["When a milestone's percent crosses a payment-plan trigger threshold, matching", " ", _jsx("code", { className: "px-1 bg-gray-100 rounded", children: "ON_CONSTRUCTION_PCT" }), " payments fire automatically."] }), loading ? (_jsx("p", { className: "text-gray-500", children: "Loading\u2026" })) : (_jsxs("div", { className: "space-y-3", children: [STAGES.map((stage) => {
                        const items = milestones.filter((m) => m.stage === stage);
                        if (items.length === 0)
                            return null;
                        return (_jsxs("section", { className: "border rounded p-4", children: [_jsx("h3", { className: "font-semibold text-sm uppercase text-gray-700 mb-2", children: stage }), _jsx("div", { className: "space-y-2", children: items.map((m) => (_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium", children: m.label }), _jsxs("div", { className: "text-xs text-gray-500", children: [m.description ?? "", m.expectedDate && ` · expected ${new Date(m.expectedDate).toLocaleDateString()}`, m.achievedDate && ` · achieved ${new Date(m.achievedDate).toLocaleDateString()}`] }), _jsx("div", { className: "w-full bg-gray-200 rounded h-2 mt-1", children: _jsx("div", { className: "bg-blue-600 h-2 rounded", style: { width: `${m.percentComplete}%` } }) })] }), _jsx("input", { type: "number", min: 0, max: 100, defaultValue: m.percentComplete, className: "w-20 border rounded px-2 py-1 text-sm", onBlur: (e) => {
                                                    const v = Number(e.target.value);
                                                    if (v !== m.percentComplete)
                                                        void updatePct(m, v);
                                                } }), _jsx("span", { className: "text-sm w-10 text-right", children: "%" })] }, m.id))) })] }, stage));
                    }), milestones.length === 0 && (_jsx("p", { className: "text-gray-500", children: "No construction milestones yet." }))] }))] }));
}
