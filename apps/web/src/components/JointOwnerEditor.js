import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { dealPartiesApi } from "../services/phase2ApiService";
/**
 * Edit the joint-owner / co-buyer composition of a deal.  Enforces
 * sum-to-100 and exactly-one-PRIMARY on save.
 */
export default function JointOwnerEditor({ dealId }) {
    const [parties, setParties] = useState([]);
    const [leadOptions, setLeadOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        setLoading(true);
        try {
            const [list, leads] = await Promise.all([
                dealPartiesApi.list(dealId),
                axios.get("/api/leads", { params: { limit: 100 } }).then((r) => r.data.data ?? r.data),
            ]);
            setParties(list);
            setLeadOptions(leads);
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
    }, [dealId]);
    const updateParty = (idx, key, value) => {
        const next = [...parties];
        next[idx][key] =
            key === "ownershipPercentage" ? Number(value) : value;
        setParties(next);
    };
    const addParty = () => {
        setParties([
            ...parties,
            {
                id: `new-${Date.now()}`,
                leadId: "",
                role: "CO_BUYER",
                ownershipPercentage: 0,
                lead: { id: "", firstName: "—", lastName: "", phone: "" },
            },
        ]);
    };
    const removeParty = (idx) => {
        setParties(parties.filter((_, i) => i !== idx));
    };
    const sum = parties.reduce((a, p) => a + (p.ownershipPercentage || 0), 0);
    const primaries = parties.filter((p) => p.role === "PRIMARY").length;
    const valid = Math.abs(sum - 100) < 0.01 && primaries === 1 && parties.every((p) => p.leadId);
    const save = async () => {
        if (!valid) {
            toast.error(`Invalid: ${primaries !== 1 ? `${primaries} primaries · ` : ""}sum=${sum.toFixed(2)}%`);
            return;
        }
        try {
            await dealPartiesApi.replace(dealId, parties.map((p) => ({
                leadId: p.leadId,
                role: p.role,
                ownershipPercentage: p.ownershipPercentage,
            })));
            toast.success("Parties saved");
            await load();
        }
        catch (e) {
            toast.error(e.response?.data?.error ?? e.message);
        }
    };
    if (loading)
        return _jsx("p", { className: "text-gray-500 text-sm", children: "Loading parties\u2026" });
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h4", { className: "font-medium text-sm", children: "Buyers & Joint Owners" }), _jsxs("span", { className: `text-xs ${valid ? "text-green-700" : "text-red-700"}`, children: ["Sum: ", sum.toFixed(2), "% \u00B7 ", primaries, " primary"] })] }), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase text-gray-500 border-b", children: [_jsx("th", { className: "py-1", children: "Lead" }), _jsx("th", { children: "Role" }), _jsx("th", { children: "Ownership %" }), _jsx("th", {})] }) }), _jsx("tbody", { children: parties.map((p, idx) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-1", children: _jsxs("select", { className: "border rounded px-1 py-0.5 text-sm w-full", value: p.leadId, onChange: (e) => updateParty(idx, "leadId", e.target.value), children: [_jsx("option", { value: "", children: "Select lead\u2026" }), leadOptions.map((l) => (_jsxs("option", { value: l.id, children: [l.firstName, " ", l.lastName ?? "", " \u00B7 ", l.phone] }, l.id)))] }) }), _jsx("td", { children: _jsxs("select", { className: "border rounded px-1 py-0.5 text-sm", value: p.role, onChange: (e) => updateParty(idx, "role", e.target.value), children: [_jsx("option", { children: "PRIMARY" }), _jsx("option", { children: "CO_BUYER" }), _jsx("option", { children: "GUARANTOR" })] }) }), _jsx("td", { children: _jsx("input", { type: "number", min: 0, max: 100, step: 0.01, className: "border rounded px-1 py-0.5 text-sm w-24", value: p.ownershipPercentage, onChange: (e) => updateParty(idx, "ownershipPercentage", e.target.value) }) }), _jsx("td", { children: _jsx("button", { className: "text-red-600 text-xs hover:underline", onClick: () => removeParty(idx), children: "Remove" }) })] }, p.id))) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "text-sm text-blue-600 hover:underline", onClick: addParty, children: "+ Add party" }), _jsx("div", { className: "flex-1" }), _jsx("button", { disabled: !valid, className: "bg-blue-600 disabled:bg-gray-300 text-white text-sm px-3 py-1 rounded", onClick: save, children: "Save Parties" })] })] }));
}
