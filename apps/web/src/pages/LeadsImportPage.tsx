// ---------------------------------------------------------------------------
// LeadsImportPage — bulk-add leads from a CSV.
//
// Why: pasting 50 broker referrals into the QuickLead modal one at a time is
// the highest-friction part of onboarding a new sales week. The server-side
// route reuses createLead() so phone normalization, duplicate-detection, and
// auto-task creation stay identical to the manual flow — the page is a thin
// upload UI plus a row-by-row error log so the operator can fix and re-upload.
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "../components/layout";
import { Button } from "@/components/ui/button";
import { extractApiError } from "@/lib/apiError";

interface RowError {
  row: number;
  field?: string;
  message: string;
  existingId?: string;
}

interface ImportResponse {
  imported: number;
  skipped:  number;
  errors:   RowError[];
}

const TEMPLATE_HEADER = "firstName,lastName,phone,email,source,assignedAgentEmail,notes";
const TEMPLATE_EXAMPLE =
  `Aisha,Khan,+971501234567,aisha@example.com,WEBSITE,agent@example.com,Interested in Marina view`;

export default function LeadsImportPage() {
  const [file,       setFile]       = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const [result,     setResult]     = useState<ImportResponse | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onSelect = useCallback((next: File | null) => {
    setResult(null);
    if (!next) {
      setFile(null);
      return;
    }
    const okExt = /\.csv$/i.test(next.name);
    const okMime =
      next.type === "text/csv" ||
      next.type === "application/vnd.ms-excel" ||
      next.type === "text/plain" ||
      next.type === "";
    if (!okExt && !okMime) {
      toast.error("Please pick a CSV file (.csv).");
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      toast.error("File is larger than 5 MB.");
      return;
    }
    setFile(next);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const next = e.dataTransfer.files?.[0] ?? null;
      onSelect(next);
    },
    [onSelect]
  );

  const downloadTemplate = useCallback(() => {
    const body = `${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE}\n`;
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "leads-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const submit = useCallback(async () => {
    if (!file) {
      toast.error("Pick a CSV file first.");
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const response = await axios.post<ImportResponse>("/api/leads/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(response.data);
      toast.success(
        `Imported ${response.data.imported}, skipped ${response.data.skipped}`
      );
    } catch (e: any) {
      toast.error(extractApiError(e, "Upload failed"));
    } finally {
      setSubmitting(false);
    }
  }, [file]);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Leads", path: "/leads" }, { label: "Import CSV" }]}
        title="Import leads from CSV"
        subtitle="Upload a CSV to create many leads in one step. Each row goes through the same validation as the manual form."
      />

      <div className="flex-1 overflow-auto">
        <PageContainer padding="default" className="space-y-6">
          {/* ---- File picker / drop zone ---- */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-8 text-center transition ${
              dragOver ? "border-primary bg-info-soft" : "border-border bg-card"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
              className="hidden"
              onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            />
            <p className="text-sm text-muted-foreground">Drop a CSV here, or</p>
            <Button type="button" onClick={() => inputRef.current?.click()} className="mt-2">
              Choose file
            </Button>
            {file && (
              <p className="mt-3 text-sm text-foreground">
                <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* ---- Actions ---- */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button type="button" onClick={submit} disabled={!file || submitting}>
              {submitting ? "Importing…" : "Import leads"}
            </Button>
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              Download template
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFile(null);
                setResult(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Reset
            </Button>
          </div>

          {/* ---- Format help ---- */}
          <details className="rounded-md border border-border bg-card p-4 text-sm">
            <summary className="cursor-pointer font-medium">CSV format</summary>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p>
                First row must be a header. Required columns:{" "}
                <code>firstName</code>, <code>lastName</code>, <code>phone</code>,{" "}
                <code>source</code>, <code>assignedAgentEmail</code>.
              </p>
              <p>
                Optional columns: <code>email</code>, <code>notes</code>.
              </p>
              <p>
                <code>source</code> must be one of: DIRECT, BROKER, WEBSITE, REFERRAL.{" "}
                <code>assignedAgentEmail</code> must match a user account.{" "}
                Maximum 1000 rows per upload.
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
{TEMPLATE_HEADER}
{TEMPLATE_EXAMPLE}
              </pre>
            </div>
          </details>

          {/* ---- Results ---- */}
          {result && (
            <section className="space-y-4">
              <div className="rounded-md border border-border bg-card p-4 text-sm">
                <p>
                  <span className="text-success font-semibold">Imported {result.imported}</span>
                  {", "}
                  <span className="text-destructive font-semibold">Skipped {result.skipped}</span>
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="overflow-auto rounded-md border border-border max-h-96">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium w-16">Row</th>
                        <th className="px-3 py-2 text-left font-medium w-32">Field</th>
                        <th className="px-3 py-2 text-left font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {result.errors.map((err) => (
                        <tr key={`${err.row}-${err.field ?? ""}`} className="bg-destructive-soft">
                          <td className="px-3 py-2 tabular-nums">{err.row}</td>
                          <td className="px-3 py-2 font-mono text-xs">{err.field ?? "—"}</td>
                          <td className="px-3 py-2 text-destructive">
                            {err.message}
                            {err.existingId && (
                              <span className="ml-2 text-xs text-muted-foreground font-mono">
                                (existing id: {err.existingId})
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </PageContainer>
      </div>
    </div>
  );
}
