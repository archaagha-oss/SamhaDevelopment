import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useCreateProjectUpdate, useDeleteProjectUpdate, useDeleteProjectUpdateMedia, useProjectUpdates, useUpdateProjectUpdate, useUploadProjectUpdateMedia, } from "../hooks/useProjectUpdates";
export default function ProjectUpdatesTab({ projectId }) {
    const updatesQuery = useProjectUpdates(projectId);
    const create = useCreateProjectUpdate(projectId);
    const patch = useUpdateProjectUpdate(projectId);
    const remove = useDeleteProjectUpdate(projectId);
    const uploadMedia = useUploadProjectUpdateMedia(projectId);
    const deleteMedia = useDeleteProjectUpdateMedia(projectId);
    const [draftTitle, setDraftTitle] = useState("");
    const [draftBody, setDraftBody] = useState("");
    const [draftPublic, setDraftPublic] = useState(true);
    const handleCreate = async () => {
        if (!draftTitle.trim() || !draftBody.trim())
            return;
        await create.mutateAsync({ title: draftTitle.trim(), body: draftBody.trim(), isPublic: draftPublic });
        setDraftTitle("");
        setDraftBody("");
        setDraftPublic(true);
    };
    const handleAddMedia = async (updateId, file) => {
        await uploadMedia.mutateAsync({ updateId, file });
    };
    return (_jsxs("section", { style: { padding: 16 }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "Project updates" }), _jsxs("p", { style: { color: "#666", fontSize: 14, marginTop: -4 }, children: ["Updates marked ", _jsx("strong", { children: "Public" }), " appear on every shared client link for units in this project."] }), _jsxs("div", { style: {
                    padding: 12,
                    border: "1px dashed #d4d4d8",
                    borderRadius: 8,
                    marginTop: 12,
                    display: "grid",
                    gap: 8,
                }, children: [_jsx("input", { type: "text", placeholder: "Title (e.g. Foundation poured)", value: draftTitle, onChange: (e) => setDraftTitle(e.target.value), style: { padding: 8, fontSize: 14 } }), _jsx("textarea", { placeholder: "Body \u2014 what's the latest on site?", value: draftBody, onChange: (e) => setDraftBody(e.target.value), rows: 3, style: { padding: 8, fontSize: 14 } }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("label", { style: { fontSize: 14, display: "flex", gap: 6, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: draftPublic, onChange: (e) => setDraftPublic(e.target.checked) }), "Visible on client share links"] }), _jsx("button", { type: "button", onClick: handleCreate, disabled: create.isPending || !draftTitle.trim() || !draftBody.trim(), style: {
                                    padding: "8px 14px",
                                    border: "1px solid #1f2937",
                                    background: "#1f2937",
                                    color: "#fff",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: 14,
                                }, children: create.isPending ? "Posting…" : "Post update" })] })] }), _jsx("div", { style: { marginTop: 24, display: "grid", gap: 16 }, children: updatesQuery.isLoading ? (_jsx("p", { style: { color: "#888" }, children: "Loading\u2026" })) : (updatesQuery.data ?? []).length === 0 ? (_jsx("p", { style: { color: "#888" }, children: "No updates yet." })) : ((updatesQuery.data ?? []).map((u) => (_jsxs("article", { style: { padding: 16, border: "1px solid #ececef", borderRadius: 8 }, children: [_jsxs("header", { style: { display: "flex", justifyContent: "space-between", gap: 12 }, children: [_jsxs("div", { children: [_jsx("h3", { style: { margin: 0 }, children: u.title }), _jsxs("p", { style: { margin: "4px 0 0 0", color: "#888", fontSize: 13 }, children: [new Date(u.publishedAt).toLocaleString(), " \u00B7 ", u.isPublic ? "Public" : "Internal"] })] }), _jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("button", { type: "button", onClick: () => patch.mutate({ updateId: u.id, isPublic: !u.isPublic }), style: btnSecondary, children: u.isPublic ? "Make internal" : "Make public" }), _jsx("button", { type: "button", onClick: () => {
                                                if (confirm("Delete this update permanently?"))
                                                    remove.mutate(u.id);
                                            }, style: { ...btnSecondary, color: "#a40000", borderColor: "#f3c4c4" }, children: "Delete" })] })] }), _jsx("p", { style: { whiteSpace: "pre-wrap", marginTop: 12 }, children: u.body }), u.media.length > 0 && (_jsx("div", { style: {
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                                gap: 8,
                                marginTop: 12,
                            }, children: u.media.map((m) => (_jsxs("figure", { style: { margin: 0, position: "relative" }, children: [m.type === "PHOTO" ? (_jsx("img", { src: m.url, alt: m.caption ?? "Update photo", style: { width: "100%", height: 100, objectFit: "cover", borderRadius: 6 } })) : (_jsx("video", { src: m.url, controls: true, style: { width: "100%", height: 100, borderRadius: 6 } })), _jsx("button", { type: "button", onClick: () => deleteMedia.mutate({ updateId: u.id, mediaId: m.id }), style: {
                                            position: "absolute",
                                            top: 4,
                                            right: 4,
                                            padding: "2px 6px",
                                            border: "none",
                                            background: "rgba(0,0,0,0.6)",
                                            color: "#fff",
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            fontSize: 11,
                                        }, children: "Remove" })] }, m.id))) })), _jsx("div", { style: { marginTop: 12 }, children: _jsxs("label", { style: {
                                    fontSize: 13,
                                    color: "#444",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                }, children: ["Add photo/video:", _jsx("input", { type: "file", accept: "image/*,video/mp4,video/quicktime", onChange: (e) => {
                                            const file = e.target.files?.[0];
                                            if (file)
                                                handleAddMedia(u.id, file);
                                            e.target.value = "";
                                        } })] }) })] }, u.id)))) })] }));
}
const btnSecondary = {
    padding: "6px 10px",
    border: "1px solid #d4d4d8",
    background: "#fff",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
};
