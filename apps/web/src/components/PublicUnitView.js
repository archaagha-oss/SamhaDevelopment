import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicDocumentDownloadUrl, usePublicShare, } from "../hooks/usePublicShare";
function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
    catch {
        return iso;
    }
}
function formatStatusEntry(e) {
    if (e.field === "projectStatus") {
        return `Project status changed to ${e.newValue}`;
    }
    if (e.field === "completionStatus") {
        return `Construction stage updated to ${e.newValue.replace(/_/g, " ")}`;
    }
    if (e.field === "handoverDate") {
        if (!e.newValue)
            return "Handover date cleared";
        return `Handover date set to ${formatDate(e.newValue)}`;
    }
    return `${e.field} changed to ${e.newValue}`;
}
export default function PublicUnitView() {
    const { token } = useParams();
    const result = usePublicShare(token ?? "");
    const [downloadingId, setDownloadingId] = useState(null);
    const feed = useMemo(() => {
        if (!result.data?.ok)
            return [];
        const items = [];
        for (const entry of result.data.data.statusHistory) {
            items.push({ kind: "status", date: entry.changedAt, entry });
        }
        for (const update of result.data.data.updates) {
            items.push({ kind: "update", date: update.publishedAt, update });
        }
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return items;
    }, [result.data]);
    if (result.isLoading) {
        return (_jsx("div", { style: containerStyle, children: _jsx("p", { style: { color: "#666" }, children: "Loading\u2026" }) }));
    }
    if (!result.data || !result.data.ok) {
        const kind = result.data?.error ?? "UNKNOWN";
        const headline = kind === "REVOKED"
            ? "This share link has been revoked."
            : kind === "EXPIRED"
                ? "This share link has expired."
                : kind === "RATE_LIMITED"
                    ? "Too many requests — please try again in a minute."
                    : "Share link not found.";
        return (_jsx("div", { style: containerStyle, children: _jsxs("div", { style: emptyStyle, children: [_jsx("h1", { style: { margin: 0, fontSize: 22 }, children: "Link unavailable" }), _jsx("p", { style: { marginTop: 12, color: "#555" }, children: headline }), _jsx("p", { style: { marginTop: 8, color: "#888", fontSize: 14 }, children: "Please contact the agent who shared this link with you." })] }) }));
    }
    const view = result.data.data;
    const photos = view.unit.images.filter((img) => img.type === "PHOTO");
    const floorPlans = view.unit.images.filter((img) => img.type === "FLOOR_PLAN" || img.type === "FLOOR_MAP");
    const handleDownload = async (docId) => {
        if (!token)
            return;
        setDownloadingId(docId);
        try {
            const url = await fetchPublicDocumentDownloadUrl(token, docId);
            window.open(url, "_blank", "noopener,noreferrer");
        }
        finally {
            setDownloadingId(null);
        }
    };
    return (_jsxs("div", { style: containerStyle, children: [_jsxs("header", { style: headerStyle, children: [_jsxs("div", { children: [_jsxs("p", { style: { margin: 0, color: "#888", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }, children: [view.project.name, " \u00B7 ", view.project.location] }), _jsxs("h1", { style: { margin: "6px 0 0 0", fontSize: 28 }, children: ["Unit ", view.unit.unitNumber, " \u00B7 Floor ", view.unit.floor] })] }), _jsxs("div", { style: badgeRowStyle, children: [_jsx("span", { style: badgeStyle, children: view.project.completionStatus.replace(/_/g, " ") }), _jsxs("span", { style: badgeStyle, children: ["Handover ", formatDate(view.project.handoverDate)] })] })] }), photos.length > 0 && (_jsxs("section", { style: sectionStyle, children: [_jsx("h2", { style: h2Style, children: "Photos" }), _jsx("div", { style: galleryStyle, children: photos.map((p) => (_jsxs("figure", { style: figureStyle, children: [_jsx("img", { src: p.url, alt: p.caption ?? `Photo of unit ${view.unit.unitNumber}`, style: imgStyle }), p.caption ? _jsx("figcaption", { style: captionStyle, children: p.caption }) : null] }, p.id))) })] })), _jsxs("section", { style: sectionStyle, children: [_jsx("h2", { style: h2Style, children: "Specifications" }), _jsxs("dl", { style: dlStyle, children: [_jsx(Spec, { label: "Type", value: view.unit.type.replace(/_/g, " ") }), _jsx(Spec, { label: "Floor", value: String(view.unit.floor) }), _jsx(Spec, { label: "Total area", value: `${view.unit.area} m²` }), _jsx(Spec, { label: "View", value: view.unit.view }), _jsx(Spec, { label: "Bathrooms", value: view.unit.bathrooms != null ? String(view.unit.bathrooms) : "—" }), _jsx(Spec, { label: "Parking", value: view.unit.parkingSpaces != null ? String(view.unit.parkingSpaces) : "—" }), _jsx(Spec, { label: "Suite", value: view.unit.internalArea != null ? `${view.unit.internalArea} m²` : "—" }), _jsx(Spec, { label: "Balcony", value: view.unit.externalArea != null ? `${view.unit.externalArea} m²` : "—" }), _jsx(Spec, { label: "Price", value: view.unit.price != null ? `AED ${view.unit.price.toLocaleString()}` : "Price on request" })] })] }), floorPlans.length > 0 && (_jsxs("section", { style: sectionStyle, children: [_jsx("h2", { style: h2Style, children: "Floor plans" }), _jsx("div", { style: galleryStyle, children: floorPlans.map((p) => (_jsxs("figure", { style: figureStyle, children: [_jsx("img", { src: p.url, alt: p.caption ?? "Floor plan", style: imgStyle }), p.caption ? _jsx("figcaption", { style: captionStyle, children: p.caption }) : null] }, p.id))) })] })), view.documents.length > 0 && (_jsxs("section", { style: sectionStyle, children: [_jsx("h2", { style: h2Style, children: "Plans & documents" }), _jsx("ul", { style: listStyle, children: view.documents.map((doc) => (_jsxs("li", { style: docItemStyle, children: [_jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontWeight: 600 }, children: doc.name }), _jsxs("p", { style: { margin: "4px 0 0 0", fontSize: 12, color: "#888" }, children: [doc.type.replace(/_/g, " "), " \u00B7 ", formatDate(doc.uploadedAt)] })] }), _jsx("button", { type: "button", style: btnStyle, onClick: () => handleDownload(doc.id), disabled: downloadingId === doc.id, children: downloadingId === doc.id ? "Opening…" : "Download" })] }, doc.id))) })] })), _jsxs("section", { style: sectionStyle, children: [_jsx("h2", { style: h2Style, children: "Latest updates" }), feed.length === 0 ? (_jsx("p", { style: { color: "#888" }, children: "No updates yet \u2014 check back soon." })) : (_jsx("ol", { style: timelineStyle, children: feed.map((item, idx) => item.kind === "status" ? (_jsxs("li", { style: timelineItemStyle, children: [_jsx("p", { style: { margin: 0, fontSize: 13, color: "#888" }, children: formatDate(item.date) }), _jsx("p", { style: { margin: "4px 0 0 0" }, children: formatStatusEntry(item.entry) })] }, `s-${item.entry.id}-${idx}`)) : (_jsxs("li", { style: timelineItemStyle, children: [_jsx("p", { style: { margin: 0, fontSize: 13, color: "#888" }, children: formatDate(item.date) }), _jsx("h3", { style: { margin: "4px 0 0 0", fontSize: 18 }, children: item.update.title }), _jsx("p", { style: { margin: "8px 0 0 0", whiteSpace: "pre-wrap", color: "#333" }, children: item.update.body }), item.update.media.length > 0 && (_jsx("div", { style: { ...galleryStyle, marginTop: 12 }, children: item.update.media.map((m) => m.type === "PHOTO" ? (_jsxs("figure", { style: figureStyle, children: [_jsx("img", { src: m.url, alt: m.caption ?? "Project update photo", style: imgStyle }), m.caption ? _jsx("figcaption", { style: captionStyle, children: m.caption }) : null] }, m.id)) : (_jsxs("figure", { style: figureStyle, children: [_jsx("video", { src: m.url, controls: true, style: imgStyle }), m.caption ? _jsx("figcaption", { style: captionStyle, children: m.caption }) : null] }, m.id))) }))] }, `u-${item.update.id}-${idx}`))) }))] }), _jsx("footer", { style: footerStyle, children: _jsxs("p", { children: ["Shared with you by the ", view.project.name, " sales team."] }) })] }));
}
function Spec({ label, value }) {
    return (_jsxs("div", { style: specStyle, children: [_jsx("dt", { style: { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 }, children: label }), _jsx("dd", { style: { margin: "4px 0 0 0", fontSize: 16, fontWeight: 500 }, children: value })] }));
}
const containerStyle = {
    maxWidth: 960,
    margin: "0 auto",
    padding: "32px 24px 64px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#222",
    background: "#fff",
};
const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
    borderBottom: "1px solid #eee",
    paddingBottom: 24,
    marginBottom: 32,
};
const badgeRowStyle = { display: "flex", gap: 8, flexWrap: "wrap" };
const badgeStyle = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    background: "#f1f1f4",
    fontSize: 12,
    color: "#444",
};
const sectionStyle = { marginBottom: 40 };
const h2Style = { fontSize: 18, margin: "0 0 16px 0" };
const galleryStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
};
const figureStyle = { margin: 0 };
const imgStyle = {
    width: "100%",
    height: 180,
    objectFit: "cover",
    borderRadius: 8,
    background: "#f6f6f8",
};
const captionStyle = { fontSize: 12, color: "#888", marginTop: 6 };
const dlStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 16,
    margin: 0,
};
const specStyle = { padding: 12, background: "#fafafb", borderRadius: 8 };
const listStyle = { listStyle: "none", padding: 0, margin: 0 };
const docItemStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    border: "1px solid #ececef",
    borderRadius: 8,
    marginBottom: 8,
};
const btnStyle = {
    padding: "8px 14px",
    border: "1px solid #1f2937",
    background: "#1f2937",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
};
const timelineStyle = {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 16,
};
const timelineItemStyle = {
    padding: 16,
    border: "1px solid #ececef",
    borderRadius: 8,
};
const footerStyle = {
    borderTop: "1px solid #eee",
    paddingTop: 16,
    textAlign: "center",
    color: "#888",
    fontSize: 13,
};
const emptyStyle = {
    marginTop: 80,
    padding: 32,
    textAlign: "center",
    border: "1px solid #ececef",
    borderRadius: 12,
};
