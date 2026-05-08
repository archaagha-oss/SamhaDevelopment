import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchPublicDocumentDownloadUrl,
  usePublicShare,
  type PublicShareStatusEntry,
  type PublicShareUpdate,
} from "../hooks/usePublicShare";

type FeedItem =
  | { kind: "status"; date: string; entry: PublicShareStatusEntry }
  | { kind: "update"; date: string; update: PublicShareUpdate };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatStatusEntry(e: PublicShareStatusEntry): string {
  if (e.field === "projectStatus") {
    return `Project status changed to ${e.newValue}`;
  }
  if (e.field === "completionStatus") {
    return `Construction stage updated to ${e.newValue.replace(/_/g, " ")}`;
  }
  if (e.field === "handoverDate") {
    if (!e.newValue) return "Handover date cleared";
    return `Handover date set to ${formatDate(e.newValue)}`;
  }
  return `${e.field} changed to ${e.newValue}`;
}

export default function PublicUnitView() {
  const { token } = useParams<{ token: string }>();
  const result = usePublicShare(token ?? "");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const feed: FeedItem[] = useMemo(() => {
    if (!result.data?.ok) return [];
    const items: FeedItem[] = [];
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
    return (
      <div style={containerStyle}>
        <p style={{ color: "#666" }}>Loading…</p>
      </div>
    );
  }

  if (!result.data || !result.data.ok) {
    const kind = result.data?.error ?? "UNKNOWN";
    const headline =
      kind === "REVOKED"
        ? "This share link has been revoked."
        : kind === "EXPIRED"
        ? "This share link has expired."
        : kind === "RATE_LIMITED"
        ? "Too many requests — please try again in a minute."
        : "Share link not found.";
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Link unavailable</h1>
          <p style={{ marginTop: 12, color: "#555" }}>{headline}</p>
          <p style={{ marginTop: 8, color: "#888", fontSize: 14 }}>
            Please contact the agent who shared this link with you.
          </p>
        </div>
      </div>
    );
  }

  const view = result.data.data;
  const photos = view.unit.images.filter((img) => img.type === "PHOTO");
  const floorPlans = view.unit.images.filter((img) => img.type === "FLOOR_PLAN" || img.type === "FLOOR_MAP");

  const handleDownload = async (docId: string) => {
    if (!token) return;
    setDownloadingId(docId);
    try {
      const url = await fetchPublicDocumentDownloadUrl(token, docId);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <p style={{ margin: 0, color: "#888", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
            {view.project.name} · {view.project.location}
          </p>
          <h1 style={{ margin: "6px 0 0 0", fontSize: 28 }}>
            Unit {view.unit.unitNumber} · Floor {view.unit.floor}
          </h1>
        </div>
        <div style={badgeRowStyle}>
          <span style={badgeStyle}>{view.project.completionStatus.replace(/_/g, " ")}</span>
          <span style={badgeStyle}>Handover {formatDate(view.project.handoverDate)}</span>
        </div>
      </header>

      {photos.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Photos</h2>
          <div style={galleryStyle}>
            {photos.map((p) => (
              <figure key={p.id} style={figureStyle}>
                <img src={p.url} alt={p.caption ?? `Photo of unit ${view.unit.unitNumber}`} style={imgStyle} />
                {p.caption ? <figcaption style={captionStyle}>{p.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      )}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Specifications</h2>
        <dl style={dlStyle}>
          <Spec label="Type" value={view.unit.type.replace(/_/g, " ")} />
          <Spec label="Floor" value={String(view.unit.floor)} />
          <Spec label="Total area" value={`${view.unit.area} m²`} />
          <Spec label="View" value={view.unit.view} />
          <Spec label="Bathrooms" value={view.unit.bathrooms != null ? String(view.unit.bathrooms) : "—"} />
          <Spec label="Parking" value={view.unit.parkingSpaces != null ? String(view.unit.parkingSpaces) : "—"} />
          <Spec label="Suite" value={view.unit.internalArea != null ? `${view.unit.internalArea} m²` : "—"} />
          <Spec label="Balcony" value={view.unit.externalArea != null ? `${view.unit.externalArea} m²` : "—"} />
          <Spec
            label="Price"
            value={view.unit.price != null ? `AED ${view.unit.price.toLocaleString()}` : "Price on request"}
          />
        </dl>
      </section>

      {floorPlans.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Floor plans</h2>
          <div style={galleryStyle}>
            {floorPlans.map((p) => (
              <figure key={p.id} style={figureStyle}>
                <img src={p.url} alt={p.caption ?? "Floor plan"} style={imgStyle} />
                {p.caption ? <figcaption style={captionStyle}>{p.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      )}

      {view.documents.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Plans & documents</h2>
          <ul style={listStyle}>
            {view.documents.map((doc) => (
              <li key={doc.id} style={docItemStyle}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{doc.name}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#888" }}>
                    {doc.type.replace(/_/g, " ")} · {formatDate(doc.uploadedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  style={btnStyle}
                  onClick={() => handleDownload(doc.id)}
                  disabled={downloadingId === doc.id}
                >
                  {downloadingId === doc.id ? "Opening…" : "Download"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Latest updates</h2>
        {feed.length === 0 ? (
          <p style={{ color: "#888" }}>No updates yet — check back soon.</p>
        ) : (
          <ol style={timelineStyle}>
            {feed.map((item, idx) =>
              item.kind === "status" ? (
                <li key={`s-${item.entry.id}-${idx}`} style={timelineItemStyle}>
                  <p style={{ margin: 0, fontSize: 13, color: "#888" }}>{formatDate(item.date)}</p>
                  <p style={{ margin: "4px 0 0 0" }}>{formatStatusEntry(item.entry)}</p>
                </li>
              ) : (
                <li key={`u-${item.update.id}-${idx}`} style={timelineItemStyle}>
                  <p style={{ margin: 0, fontSize: 13, color: "#888" }}>{formatDate(item.date)}</p>
                  <h3 style={{ margin: "4px 0 0 0", fontSize: 18 }}>{item.update.title}</h3>
                  <p style={{ margin: "8px 0 0 0", whiteSpace: "pre-wrap", color: "#333" }}>{item.update.body}</p>
                  {item.update.media.length > 0 && (
                    <div style={{ ...galleryStyle, marginTop: 12 }}>
                      {item.update.media.map((m) =>
                        m.type === "PHOTO" ? (
                          <figure key={m.id} style={figureStyle}>
                            <img src={m.url} alt={m.caption ?? "Project update photo"} style={imgStyle} />
                            {m.caption ? <figcaption style={captionStyle}>{m.caption}</figcaption> : null}
                          </figure>
                        ) : (
                          <figure key={m.id} style={figureStyle}>
                            <video src={m.url} controls style={imgStyle} />
                            {m.caption ? <figcaption style={captionStyle}>{m.caption}</figcaption> : null}
                          </figure>
                        )
                      )}
                    </div>
                  )}
                </li>
              )
            )}
          </ol>
        )}
      </section>

      <footer style={footerStyle}>
        <p>Shared with you by the {view.project.name} sales team.</p>
      </footer>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div style={specStyle}>
      <dt style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{label}</dt>
      <dd style={{ margin: "4px 0 0 0", fontSize: 16, fontWeight: 500 }}>{value}</dd>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  padding: "32px 24px 64px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  color: "#222",
  background: "#fff",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: 16,
  borderBottom: "1px solid #eee",
  paddingBottom: 24,
  marginBottom: 32,
};
const badgeRowStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  background: "#f1f1f4",
  fontSize: 12,
  color: "#444",
};
const sectionStyle: React.CSSProperties = { marginBottom: 40 };
const h2Style: React.CSSProperties = { fontSize: 18, margin: "0 0 16px 0" };
const galleryStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 12,
};
const figureStyle: React.CSSProperties = { margin: 0 };
const imgStyle: React.CSSProperties = {
  width: "100%",
  height: 180,
  objectFit: "cover",
  borderRadius: 8,
  background: "#f6f6f8",
};
const captionStyle: React.CSSProperties = { fontSize: 12, color: "#888", marginTop: 6 };
const dlStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 16,
  margin: 0,
};
const specStyle: React.CSSProperties = { padding: 12, background: "#fafafb", borderRadius: 8 };
const listStyle: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0 };
const docItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 14px",
  border: "1px solid #ececef",
  borderRadius: 8,
  marginBottom: 8,
};
const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  border: "1px solid #1f2937",
  background: "#1f2937",
  color: "#fff",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
};
const timelineStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
const timelineItemStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid #ececef",
  borderRadius: 8,
};
const footerStyle: React.CSSProperties = {
  borderTop: "1px solid #eee",
  paddingTop: 16,
  textAlign: "center",
  color: "#888",
  fontSize: 13,
};
const emptyStyle: React.CSSProperties = {
  marginTop: 80,
  padding: 32,
  textAlign: "center",
  border: "1px solid #ececef",
  borderRadius: 12,
};
