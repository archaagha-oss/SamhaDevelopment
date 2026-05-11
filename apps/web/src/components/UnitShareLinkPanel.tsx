import { useState } from "react";
import {
  useCreateUnitShareToken,
  useDeleteUnitShareToken,
  useRevokeUnitShareToken,
  useUnitShareTokens,
} from "../hooks/useUnitShareTokens";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  unitId: string;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function buildAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function UnitShareLinkPanel({ unitId }: Props) {
  const tokensQuery = useUnitShareTokens(unitId);
  const create = useCreateUnitShareToken(unitId);
  const revoke = useRevokeUnitShareToken(unitId);
  const remove = useDeleteUnitShareToken(unitId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPrice, setShowPrice] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async () => {
    await create.mutateAsync({
      showPrice,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    setShowPrice(false);
    setExpiresAt("");
  };

  const handleCopy = async (id: string, url: string) => {
    const absolute = buildAbsoluteUrl(url);
    try {
      await navigator.clipboard.writeText(absolute);
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
    } catch {
      window.prompt("Copy this link:", absolute);
    }
  };

  return (
    <section
      style={{
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        padding: 16,
        marginTop: 16,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Client share links</h3>
      </header>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
          Show price
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          Expires at
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            style={{ padding: 4 }}
          />
        </label>
        <button
          type="button"
          onClick={handleCreate}
          disabled={create.isPending}
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
          {create.isPending ? "Creating…" : "Create share link"}
        </button>
      </div>

      {tokensQuery.isLoading ? (
        <p style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</p>
      ) : (tokensQuery.data ?? []).length === 0 ? (
        <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 14 }}>
          No links yet. Create one to share this unit with a client.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {(tokensQuery.data ?? []).map((t) => {
            const inactive = !!t.revokedAt || isExpired(t.expiresAt);
            return (
              <li
                key={t.id}
                style={{
                  padding: 12,
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  marginBottom: 8,
                  opacity: inactive ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <code style={{ fontSize: 12, color: "hsl(var(--foreground))", wordBreak: "break-all" }}>{buildAbsoluteUrl(t.url)}</code>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => handleCopy(t.id, t.url)} style={btnSecondary}>
                      {copiedId === t.id ? "Copied" : "Copy"}
                    </button>
                    {!t.revokedAt && (
                      <button
                        type="button"
                        onClick={() => revoke.mutate(t.id)}
                        disabled={revoke.isPending}
                        style={btnSecondary}
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(t.id)}
                      disabled={remove.isPending}
                      style={{ ...btnSecondary, color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive) / 0.3)" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {t.showPrice ? "Price visible · " : "Price hidden · "}
                  {t.expiresAt ? `Expires ${new Date(t.expiresAt).toLocaleString()} · ` : "No expiry · "}
                  {t.viewCount} view{t.viewCount === 1 ? "" : "s"}
                  {t.revokedAt ? ` · revoked ${new Date(t.revokedAt).toLocaleString()}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete share link?"
        message="Anyone with this link will immediately stop being able to view the unit. This can't be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (id) remove.mutate(id);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
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
