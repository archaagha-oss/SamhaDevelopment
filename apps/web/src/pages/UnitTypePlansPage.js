import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { typePlansApi } from "../services/phase2ApiService";
const EMPTY = {
    code: "",
    name: "",
    type: "ONE_BR",
    area: 0,
    internalArea: 0,
    externalArea: 0,
    bathrooms: 1,
    parkingSpaces: 1,
    basePrice: 0,
};
export default function UnitTypePlansPage() {
    const { projectId } = useParams();
    const [plans, setPlans] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        if (!projectId)
            return;
        setLoading(true);
        try {
            const data = await typePlansApi.listForProject(projectId);
            setPlans(data);
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
    const submit = async (e) => {
        e.preventDefault();
        if (!projectId)
            return;
        try {
            await typePlansApi.create({ ...form, projectId });
            toast.success("Type plan created");
            setShowForm(false);
            setForm(EMPTY);
            await load();
        }
        catch (err) {
            toast.error(err.response?.data?.error ?? err.message);
        }
    };
    const remove = async (id, units) => {
        if (units > 0) {
            toast.error(`Cannot delete: ${units} units still use this plan.`);
            return;
        }
        if (!confirm("Delete this type plan?"))
            return;
        try {
            await typePlansApi.remove(id);
            toast.success("Deleted");
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    if (!projectId)
        return _jsx("div", { className: "p-6", children: "Project ID required." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Unit Type Plans" }), _jsx("button", { className: "bg-blue-600 text-white px-4 py-2 rounded text-sm", onClick: () => setShowForm((s) => !s), children: showForm ? "Cancel" : "+ New Plan" })] }), showForm && (_jsxs("form", { className: "grid grid-cols-3 gap-3 bg-gray-50 p-4 rounded", onSubmit: submit, children: [[
                        ["code", "Code"],
                        ["name", "Name"],
                        ["type", "Type"],
                        ["area", "Total area (sqm)"],
                        ["internalArea", "Internal area"],
                        ["externalArea", "External area"],
                        ["bathrooms", "Bathrooms"],
                        ["parkingSpaces", "Parking"],
                        ["basePrice", "Base price (AED)"],
                    ].map(([key, label]) => (_jsxs("label", { className: "flex flex-col text-xs text-gray-700", children: [label, _jsx("input", { className: "border rounded px-2 py-1 mt-1 text-sm", value: form[key] ?? "", onChange: (e) => setForm({
                                    ...form,
                                    [key]: ["area", "internalArea", "externalArea", "bathrooms", "parkingSpaces", "basePrice"].includes(key)
                                        ? Number(e.target.value)
                                        : e.target.value,
                                }) })] }, key))), _jsx("div", { className: "col-span-3 text-right", children: _jsx("button", { className: "bg-blue-600 text-white px-3 py-1 rounded text-sm", type: "submit", children: "Save" }) })] })), loading ? (_jsx("p", { className: "text-gray-500", children: "Loading\u2026" })) : plans.length === 0 ? (_jsx("p", { className: "text-gray-500", children: "No type plans yet." })) : (_jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase text-gray-500 border-b", children: [_jsx("th", { className: "py-2", children: "Code" }), _jsx("th", { children: "Name" }), _jsx("th", { children: "Type" }), _jsx("th", { children: "Area" }), _jsx("th", { children: "Bathrooms" }), _jsx("th", { children: "Base price" }), _jsx("th", { children: "Units" }), _jsx("th", {})] }) }), _jsx("tbody", { children: plans.map((p) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-2 font-mono", children: p.code }), _jsx("td", { children: p.name }), _jsx("td", { children: p.type }), _jsx("td", { children: p.area ?? "—" }), _jsx("td", { children: p.bathrooms ?? "—" }), _jsx("td", { children: p.basePrice != null ? `AED ${p.basePrice.toLocaleString()}` : "—" }), _jsx("td", { children: p._count?.units ?? 0 }), _jsx("td", { children: _jsx("button", { className: "text-red-600 hover:underline text-sm", onClick: () => remove(p.id, p._count?.units ?? 0), children: "Delete" }) })] }, p.id))) })] }))] }));
}
