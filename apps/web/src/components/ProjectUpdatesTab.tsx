import { useState } from "react";
import {
  useCreateProjectUpdate,
  useDeleteProjectUpdate,
  useDeleteProjectUpdateMedia,
  useProjectUpdates,
  useUpdateProjectUpdate,
  useUploadProjectUpdateMedia,
} from "../hooks/useProjectUpdates";

interface Props {
  projectId: string;
}

export default function ProjectUpdatesTab({ projectId }: Props) {
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
    if (!draftTitle.trim() || !draftBody.trim()) return;
    await create.mutateAsync({ title: draftTitle.trim(), body: draftBody.trim(), isPublic: draftPublic });
    setDraftTitle("");
    setDraftBody("");
    setDraftPublic(true);
  };

  const handleAddMedia = async (updateId: string, file: File) => {
    await uploadMedia.mutateAsync({ updateId, file });
  };

  return (
    <section style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Project updates</h2>
      <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 14, marginTop: -4 }}>
        Updates marked <strong>Public</strong> appear on every shared client link for units in this project.
      </p>

      <div
        style={{
          padding: 12,
          border: "1px dashed #d4d4d8",
          borderRadius: 8,
          marginTop: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <input
          type="text"
          placeholder="Title (e.g. Foundation poured)"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          style={{ padding: 8, fontSize: 14 }}
        />
        <textarea
          placeholder="Body — what's the latest on site?"
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          rows={3}
          style={{ padding: 8, fontSize: 14 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={draftPublic} onChange={(e) => setDraftPublic(e.target.checked)} />
            Visible on client share links
          </label>
          <button
            type="button"
            onClick={handleCreate}
            disabled={create.isPending || !draftTitle.trim() || !draftBody.trim()}
            style={{
              padding: "8px 14px",
              border: "1px solid #1f2937",
              background: "#1f2937",
              color: "#fff",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {create.isPending ? "Posting…" : "Post update"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
        {updatesQuery.isLoading ? (
          <p style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</p>
        ) : (updatesQuery.data ?? []).length === 0 ? (
          <p style={{ color: "hsl(var(--muted-foreground))" }}>No updates yet.</p>
        ) : (
          (updatesQuery.data ?? []).map((u) => (
            <article
              key={u.id}
              style={{ padding: 16, border: "1px solid hsl(var(--border))", borderRadius: 8 }}
            >
              <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{u.title}</h3>
                  <p style={{ margin: "4px 0 0 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                    {new Date(u.publishedAt).toLocaleString()} · {u.isPublic ? "Public" : "Internal"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => patch.mutate({ updateId: u.id, isPublic: !u.isPublic })}
                    style={btnSecondary}
                  >
                    {u.isPublic ? "Make internal" : "Make public"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this update permanently?")) remove.mutate(u.id);
                    }}
                    style={{ ...btnSecondary, color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive) / 0.3)" }}
                  >
                    Delete
                  </button>
                </div>
              </header>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{u.body}</p>

              {u.media.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {u.media.map((m) => (
                    <figure key={m.id} style={{ margin: 0, position: "relative" }}>
                      {m.type === "PHOTO" ? (
                        <img
                          src={m.url}
                          alt={m.caption ?? "Update photo"}
                          style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6 }}
                        />
                      ) : (
                        <video src={m.url} controls style={{ width: "100%", height: 100, borderRadius: 6 }} />
                      )}
                      <button
                        type="button"
                        onClick={() => deleteMedia.mutate({ updateId: u.id, mediaId: m.id })}
                        style={{
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
                        }}
                      >
                        Remove
                      </button>
                    </figure>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label
                  style={{
                    fontSize: 13,
                    color: "hsl(var(--foreground))",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Add photo/video:
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/quicktime"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAddMedia(u.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

const btnSecondary: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #d4d4d8",
  background: "#fff",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
};
