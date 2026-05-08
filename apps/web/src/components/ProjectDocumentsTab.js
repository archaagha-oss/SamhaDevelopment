import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { useDeleteProjectDocument, useProjectDocuments, useUpdateProjectDocument, useUploadProjectDocument, } from "../hooks/useProjectDocuments";
const DOC_TYPES = [
    "OTHER",
    "SALES_OFFER",
    "RESERVATION_FORM",
    "SPA",
    "OQOOD_CERTIFICATE",
    "PAYMENT_RECEIPT",
];
export default function ProjectDocumentsTab({ projectId }) {
    const docsQuery = useProjectDocuments(projectId);
    const upload = useUploadProjectDocument(projectId);
    const update = useUpdateProjectDocument(projectId);
    const remove = useDeleteProjectDocument(projectId);
    const fileRef = useRef(null);
    const [pendingType, setPendingType] = useState("OTHER");
    const [pendingVisibility, setPendingVisibility] = useState("PUBLIC");
    const [pendingName, setPendingName] = useState("");
    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        await upload.mutateAsync({
            file,
            type: pendingType,
            visibility: pendingVisibility,
            name: pendingName.trim() || file.name,
        });
        setPendingName("");
        if (fileRef.current)
            fileRef.current.value = "";
    };
    return (_jsxs("section", { style: { padding: 16 }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "Project documents" }), _jsxs("p", { style: { color: "#666", fontSize: 14, marginTop: -4 }, children: ["Documents uploaded here are visible inside every unit in this project. Mark a document", _jsx("strong", { children: " Public " }), "to also expose it on shared client links."] }), _jsxs("div", { style: {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    padding: 12,
                    border: "1px dashed #d4d4d8",
                    borderRadius: 8,
                    marginTop: 12,
                }, children: [_jsx("input", { type: "text", placeholder: "Display name (optional)", value: pendingName, onChange: (e) => setPendingName(e.target.value), style: { padding: 6, minWidth: 200 } }), _jsx("select", { value: pendingType, onChange: (e) => setPendingType(e.target.value), style: { padding: 6 }, children: DOC_TYPES.map((t) => (_jsx("option", { value: t, children: t.replace(/_/g, " ") }, t))) }), _jsxs("select", { value: pendingVisibility, onChange: (e) => setPendingVisibility(e.target.value), style: { padding: 6 }, children: [_jsx("option", { value: "INTERNAL", children: "Internal \u2014 staff only" }), _jsx("option", { value: "PUBLIC", children: "Public \u2014 visible on shared links" })] }), _jsx("input", { ref: fileRef, type: "file", onChange: handleFile, disabled: upload.isPending }), upload.isPending && _jsx("span", { style: { color: "#666", fontSize: 13 }, children: "Uploading\u2026" })] }), _jsx("div", { style: { marginTop: 16 }, children: docsQuery.isLoading ? (_jsx("p", { style: { color: "#888" }, children: "Loading\u2026" })) : (docsQuery.data ?? []).length === 0 ? (_jsx("p", { style: { color: "#888" }, children: "No documents yet." })) : (_jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [_jsx("thead", { children: _jsxs("tr", { style: { textAlign: "left", borderBottom: "1px solid #ececef" }, children: [_jsx("th", { style: th, children: "Name" }), _jsx("th", { style: th, children: "Type" }), _jsx("th", { style: th, children: "Visibility" }), _jsx("th", { style: th, children: "Uploaded" }), _jsx("th", { style: th })] }) }), _jsx("tbody", { children: (docsQuery.data ?? []).map((d) => (_jsxs("tr", { style: { borderBottom: "1px solid #f4f4f7" }, children: [_jsx("td", { style: td, children: d.name }), _jsx("td", { style: td, children: d.type.replace(/_/g, " ") }), _jsx("td", { style: td, children: _jsxs("select", { value: d.visibility, onChange: (e) => update.mutate({ docId: d.id, visibility: e.target.value }), style: { padding: 4 }, children: [_jsx("option", { value: "INTERNAL", children: "Internal" }), _jsx("option", { value: "PUBLIC", children: "Public" })] }) }), _jsx("td", { style: td, children: new Date(d.uploadedAt).toLocaleDateString() }), _jsx("td", { style: td, children: _jsx("button", { type: "button", onClick: () => {
                                                if (confirm("Delete this document permanently?"))
                                                    remove.mutate(d.id);
                                            }, style: {
                                                padding: "4px 10px",
                                                border: "1px solid #f3c4c4",
                                                color: "#a40000",
                                                background: "#fff",
                                                borderRadius: 4,
                                                cursor: "pointer",
                                            }, children: "Delete" }) })] }, d.id))) })] })) })] }));
}
const th = { padding: "8px 6px", fontSize: 13, color: "#555" };
const td = { padding: "8px 6px", fontSize: 14 };
