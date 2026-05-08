import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
const CHANNEL_LABEL = { EMAIL: "Email", WHATSAPP: "WhatsApp", SMS: "SMS" };
const CHANNEL_ICON = { EMAIL: "✉️", WHATSAPP: "💬", SMS: "📱" };
function fmtAED(n) {
    return `AED ${n.toLocaleString("en-AE")}`;
}
function defaultBody(unit, recipientName) {
    const lines = [
        `Hi ${recipientName},`,
        "",
        `Thought you might like this${unit.projectName ? ` at ${unit.projectName}` : ""}:`,
        "",
        `• Unit ${unit.unitNumber} — ${unit.type.replace(/_/g, " ")}${unit.floor != null ? `, Floor ${unit.floor}` : ""}`,
        unit.area ? `• ${unit.area} sq m${unit.view ? `, ${unit.view.replace(/_/g, " ").toLowerCase()} view` : ""}` : "",
        `• ${fmtAED(unit.price)}`,
        "",
        `Want to take a look? Happy to share floorplans or set up a viewing.`,
    ];
    return lines.filter(Boolean).join("\n");
}
function defaultSubject(unit) {
    return `Unit ${unit.unitNumber}${unit.projectName ? ` at ${unit.projectName}` : ""} — ${fmtAED(unit.price)}`;
}
export default function ShareUnitModal({ unit, onClose }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [picked, setPicked] = useState(null);
    const [channel, setChannel] = useState("WHATSAPP");
    const [subject, setSubject] = useState(defaultSubject(unit));
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    // Search leads (debounced)
    const search = useCallback(async (q) => {
        setSearching(true);
        try {
            const r = await axios.get("/api/leads", { params: { search: q, limit: 6 } });
            setResults(r.data.data ?? r.data ?? []);
        }
        catch {
            setResults([]);
        }
        finally {
            setSearching(false);
        }
    }, []);
    useEffect(() => {
        if (picked)
            return;
        const t = setTimeout(() => { if (query.trim())
            search(query.trim());
        else
            setResults([]); }, 250);
        return () => clearTimeout(t);
    }, [query, picked, search]);
    // When a lead is picked, pre-fill body with their first name
    useEffect(() => {
        if (picked)
            setBody(defaultBody(unit, picked.firstName));
    }, [picked, unit]);
    // Hide channels the picked lead can't receive
    const availableChannels = (() => {
        if (!picked)
            return ["EMAIL", "WHATSAPP", "SMS"];
        const out = [];
        if (picked.email)
            out.push("EMAIL");
        if (picked.phone) {
            out.push("WHATSAPP");
            out.push("SMS");
        }
        return out;
    })();
    // Adjust selected channel when picking changes available set
    useEffect(() => {
        if (!availableChannels.includes(channel) && availableChannels.length > 0) {
            setChannel(availableChannels[0]);
        }
    }, [picked, availableChannels, channel]);
    const handleSend = async () => {
        if (!picked)
            return;
        if (!body.trim())
            return;
        setSending(true);
        try {
            await axios.post("/api/communications/send", {
                leadId: picked.id,
                channel,
                subject: channel === "EMAIL" ? subject || undefined : undefined,
                body,
            });
            toast.success(`Sent to ${picked.firstName} via ${CHANNEL_LABEL[channel]}`);
            onClose();
        }
        catch (err) {
            toast.error(err.response?.data?.error ?? "Send failed");
        }
        finally {
            setSending(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl my-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3.5 border-b border-slate-100", children: [_jsx("h3", { className: "font-semibold text-slate-800 text-sm", children: "Share unit with a lead" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-xl leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "px-5 py-4 space-y-4", children: [_jsxs("div", { className: "bg-slate-50 rounded-lg border border-slate-100 px-3 py-2", children: [_jsxs("p", { className: "text-sm font-semibold text-slate-800", children: ["Unit ", unit.unitNumber, " \u00B7 ", unit.type.replace(/_/g, " ")] }), _jsxs("p", { className: "text-xs text-slate-500", children: [unit.projectName ?? "", unit.projectName ? " · " : "", fmtAED(unit.price)] })] }), !picked ? (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-600 mb-1", children: "Search leads" }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Name, phone, email\u2026", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400", autoFocus: true }), _jsxs("div", { className: "mt-2 max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100", children: [searching && _jsx("p", { className: "px-3 py-3 text-xs text-slate-400", children: "Searching\u2026" }), !searching && query.trim() === "" && (_jsx("p", { className: "px-3 py-3 text-xs text-slate-400", children: "Start typing to find a lead" })), !searching && query.trim() !== "" && results.length === 0 && (_jsx("p", { className: "px-3 py-3 text-xs text-slate-400", children: "No leads match" })), !searching && results.map((l) => (_jsxs("button", { onClick: () => setPicked(l), className: "w-full text-left px-3 py-2 hover:bg-slate-50", children: [_jsxs("p", { className: "text-sm font-medium text-slate-800", children: [l.firstName, " ", l.lastName] }), _jsxs("p", { className: "text-xs text-slate-400", children: [l.phone, l.email ? ` · ${l.email}` : ""] })] }, l.id)))] })] })) : (_jsxs("div", { className: "bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-slate-800", children: [picked.firstName, " ", picked.lastName] }), _jsxs("p", { className: "text-xs text-slate-500", children: [picked.phone, picked.email ? ` · ${picked.email}` : ""] })] }), _jsx("button", { onClick: () => { setPicked(null); setQuery(""); }, className: "text-xs text-blue-600 hover:underline", children: "Change" })] })), picked && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [availableChannels.map((c) => (_jsxs("button", { onClick: () => setChannel(c), className: `text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${channel === c
                                                ? "bg-slate-800 text-white"
                                                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-400"}`, children: [CHANNEL_ICON[c], " ", CHANNEL_LABEL[c]] }, c))), availableChannels.length === 0 && (_jsx("p", { className: "text-xs text-red-500", children: "This lead has no email or phone on file." }))] }), channel === "EMAIL" && (_jsx("input", { value: subject, onChange: (e) => setSubject(e.target.value), placeholder: "Subject", className: "w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400" })), _jsx("textarea", { value: body, onChange: (e) => setBody(e.target.value), rows: 6, className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 resize-y font-sans" })] }))] }), _jsxs("div", { className: "flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50", children: [_jsx("button", { onClick: onClose, className: "px-3 py-1.5 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg", children: "Cancel" }), _jsx("button", { onClick: handleSend, disabled: !picked || !body.trim() || sending || availableChannels.length === 0, className: "px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50", children: sending ? "Sending…" : `Send via ${CHANNEL_LABEL[channel] ?? "?"}` })] })] }) }));
}
