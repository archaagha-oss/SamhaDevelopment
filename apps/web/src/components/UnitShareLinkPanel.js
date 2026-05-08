import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useCreateUnitShareToken, useDeleteUnitShareToken, useRevokeUnitShareToken, useUnitShareTokens, } from "../hooks/useUnitShareTokens";
function isExpired(expiresAt) {
    if (!expiresAt)
        return false;
    return new Date(expiresAt).getTime() < Date.now();
}
function buildAbsoluteUrl(url) {
    if (/^https?:\/\//i.test(url))
        return url;
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
export default function UnitShareLinkPanel({ unitId }) {
    const tokensQuery = useUnitShareTokens(unitId);
    const create = useCreateUnitShareToken(unitId);
    const revoke = useRevokeUnitShareToken(unitId);
    const remove = useDeleteUnitShareToken(unitId);
    const [showPrice, setShowPrice] = useState(false);
    const [expiresAt, setExpiresAt] = useState("");
    const [copiedId, setCopiedId] = useState(null);
    const handleCreate = async () => {
        await create.mutateAsync({
            showPrice,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        });
        setShowPrice(false);
        setExpiresAt("");
    };
    const handleCopy = async (id, url) => {
        const absolute = buildAbsoluteUrl(url);
        try {
            await navigator.clipboard.writeText(absolute);
            setCopiedId(id);
            setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
        }
        catch {
            window.prompt("Copy this link:", absolute);
        }
    };
    return (_jsxs("section", { style: {
            border: "1px solid #ececef",
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
        }, children: [_jsx("header", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, children: _jsx("h3", { style: { margin: 0, fontSize: 16 }, children: "Client share links" }) }), _jsxs("div", { style: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }, children: [_jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 14 }, children: [_jsx("input", { type: "checkbox", checked: showPrice, onChange: (e) => setShowPrice(e.target.checked) }), "Show price"] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 14 }, children: ["Expires at", _jsx("input", { type: "datetime-local", value: expiresAt, onChange: (e) => setExpiresAt(e.target.value), style: { padding: 4 } })] }), _jsx("button", { type: "button", onClick: handleCreate, disabled: create.isPending, style: {
                            padding: "8px 14px",
                            border: "1px solid #1f2937",
                            background: "#1f2937",
                            color: "#fff",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                        }, children: create.isPending ? "Creating…" : "Create share link" })] }), tokensQuery.isLoading ? (_jsx("p", { style: { color: "#888" }, children: "Loading\u2026" })) : (tokensQuery.data ?? []).length === 0 ? (_jsx("p", { style: { color: "#888", fontSize: 14 }, children: "No links yet. Create one to share this unit with a client." })) : (_jsx("ul", { style: { listStyle: "none", padding: 0, margin: 0 }, children: (tokensQuery.data ?? []).map((t) => {
                    const inactive = !!t.revokedAt || isExpired(t.expiresAt);
                    return (_jsxs("li", { style: {
                            padding: 12,
                            border: "1px solid #ececef",
                            borderRadius: 6,
                            marginBottom: 8,
                            opacity: inactive ? 0.6 : 1,
                        }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }, children: [_jsx("code", { style: { fontSize: 12, color: "#444", wordBreak: "break-all" }, children: buildAbsoluteUrl(t.url) }), _jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { type: "button", onClick: () => handleCopy(t.id, t.url), style: btnSecondary, children: copiedId === t.id ? "Copied" : "Copy" }), !t.revokedAt && (_jsx("button", { type: "button", onClick: () => revoke.mutate(t.id), disabled: revoke.isPending, style: btnSecondary, children: "Revoke" })), _jsx("button", { type: "button", onClick: () => {
                                                    if (confirm("Delete this share link permanently?"))
                                                        remove.mutate(t.id);
                                                }, disabled: remove.isPending, style: { ...btnSecondary, color: "#a40000", borderColor: "#f3c4c4" }, children: "Delete" })] })] }), _jsxs("p", { style: { margin: "8px 0 0 0", fontSize: 12, color: "#666" }, children: [t.showPrice ? "Price visible · " : "Price hidden · ", t.expiresAt ? `Expires ${new Date(t.expiresAt).toLocaleString()} · ` : "No expiry · ", t.viewCount, " view", t.viewCount === 1 ? "" : "s", t.revokedAt ? ` · revoked ${new Date(t.revokedAt).toLocaleString()}` : ""] })] }, t.id));
                }) }))] }));
}
const btnSecondary = {
    padding: "6px 10px",
    border: "1px solid #d4d4d8",
    background: "#fff",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
};
