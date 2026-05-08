import { useRef, useState } from "react";
import {
  useDeleteProjectDocument,
  useProjectDocuments,
  useUpdateProjectDocument,
  useUploadProjectDocument,
  type DocumentVisibility,
} from "../hooks/useProjectDocuments";

const DOC_TYPES = [
  "OTHER",
  "SALES_OFFER",
  "RESERVATION_FORM",
  "SPA",
  "OQOOD_CERTIFICATE",
  "PAYMENT_RECEIPT",
];

interface Props {
  projectId: string;
}

export default function ProjectDocumentsTab({ projectId }: Props) {
  const docsQuery = useProjectDocuments(projectId);
  const upload = useUploadProjectDocument(projectId);
  const update = useUpdateProjectDocument(projectId);
  const remove = useDeleteProjectDocument(projectId);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingType, setPendingType] = useState<string>("OTHER");
  const [pendingVisibility, setPendingVisibility] = useState<DocumentVisibility>("PUBLIC");
  const [pendingName, setPendingName] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload.mutateAsync({
      file,
      type: pendingType,
      visibility: pendingVisibility,
      name: pendingName.trim() || file.name,
    });
    setPendingName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Project documents</h2>
      <p style={{ color: "#666", fontSize: 14, marginTop: -4 }}>
        Documents uploaded here are visible inside every unit in this project. Mark a document
        <strong> Public </strong>
        to also expose it on shared client links.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          padding: 12,
          border: "1px dashed #d4d4d8",
          borderRadius: 8,
          marginTop: 12,
        }}
      >
        <input
          type="text"
          placeholder="Display name (optional)"
          value={pendingName}
          onChange={(e) => setPendingName(e.target.value)}
          style={{ padding: 6, minWidth: 200 }}
        />
        <select value={pendingType} onChange={(e) => setPendingType(e.target.value)} style={{ padding: 6 }}>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={pendingVisibility}
          onChange={(e) => setPendingVisibility(e.target.value as DocumentVisibility)}
          style={{ padding: 6 }}
        >
          <option value="INTERNAL">Internal — staff only</option>
          <option value="PUBLIC">Public — visible on shared links</option>
        </select>
        <input ref={fileRef} type="file" onChange={handleFile} disabled={upload.isPending} />
        {upload.isPending && <span style={{ color: "#666", fontSize: 13 }}>Uploading…</span>}
      </div>

      <div style={{ marginTop: 16 }}>
        {docsQuery.isLoading ? (
          <p style={{ color: "#888" }}>Loading…</p>
        ) : (docsQuery.data ?? []).length === 0 ? (
          <p style={{ color: "#888" }}>No documents yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ececef" }}>
                <th style={th}>Name</th>
                <th style={th}>Type</th>
                <th style={th}>Visibility</th>
                <th style={th}>Uploaded</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {(docsQuery.data ?? []).map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #f4f4f7" }}>
                  <td style={td}>{d.name}</td>
                  <td style={td}>{d.type.replace(/_/g, " ")}</td>
                  <td style={td}>
                    <select
                      value={d.visibility}
                      onChange={(e) =>
                        update.mutate({ docId: d.id, visibility: e.target.value as DocumentVisibility })
                      }
                      style={{ padding: 4 }}
                    >
                      <option value="INTERNAL">Internal</option>
                      <option value="PUBLIC">Public</option>
                    </select>
                  </td>
                  <td style={td}>{new Date(d.uploadedAt).toLocaleDateString()}</td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this document permanently?")) remove.mutate(d.id);
                      }}
                      style={{
                        padding: "4px 10px",
                        border: "1px solid #f3c4c4",
                        color: "#a40000",
                        background: "#fff",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

const th: React.CSSProperties = { padding: "8px 6px", fontSize: 13, color: "#555" };
const td: React.CSSProperties = { padding: "8px 6px", fontSize: 14 };
