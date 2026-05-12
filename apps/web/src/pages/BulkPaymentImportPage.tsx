import { useCallback, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "../components/layout";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Bulk payment import — finance/admin tool. Accepts a CSV listing payments
// that the bank has confirmed received this week, and applies them via the
// existing markPaymentPaid / recordPartialPayment server-side helpers. The
// page is intentionally simple: drop or pick a CSV, submit, see per-row
// outcomes in a table.
// ---------------------------------------------------------------------------

interface RowError {
  row: number;
  reason: string;
  dealNumber?: string;
  milestoneLabel?: string;
  paymentId?: string;
}

interface RowSuccess {
  row: number;
  paymentId: string;
  dealNumber?: string;
  milestoneLabel?: string;
  action: "MARKED_PAID" | "PARTIAL_RECORDED";
}

interface ImportResponse {
  totalRows:    number;
  successCount: number;
  errorCount:   number;
  errors:       RowError[];
  successes:    RowSuccess[];
}

const SAMPLE_HEADER = "dealNumber,milestoneLabel,amount,paidDate,paymentMethod,receiptKey,notes";

export default function BulkPaymentImportPage() {
  const [file,        setFile]        = useState<File | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const [result,      setResult]      = useState<ImportResponse | null>(null);
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
      const response = await axios.post<ImportResponse>(
        "/api/payments/bulk-import",
        fd,
        {
          headers: {
            "Content-Type":    "multipart/form-data",
            // Generate a per-submission idempotency key so a retry of the
            // same upload replays the cached response instead of double-
            // applying every row.
            "Idempotency-Key": `bulk-payments-${file.name}-${file.size}-${file.lastModified}`,
          },
        }
      );
      setResult(response.data);
      toast.success(
        `Processed ${response.data.totalRows} row(s): ${response.data.successCount} ok, ${response.data.errorCount} error(s)`
      );
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || "Upload failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [file]);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Payments", path: "/payments" }, { label: "Bulk import" }]}
        title="Bulk payment import"
        subtitle="Upload a CSV to mark many payments as paid or partial in one step (finance only)."
      />

      <div className="flex-1 overflow-auto">
      <PageContainer padding="default" className="space-y-6">
        {/* ---- File picker / drop zone ---- */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed p-8 text-center transition ${
            dragOver
              ? "border-primary bg-info-soft"
              : "border-border bg-card"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
            className="hidden"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
          <p className="text-sm text-muted-foreground">
            Drop a CSV here, or
          </p>
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2"
          >
            Choose file
          </Button>
          {file && (
            <p className="mt-3 text-sm text-foreground">
              <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* ---- Submit ---- */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={submit}
            disabled={!file || submitting}
          >
            {submitting ? "Importing…" : "Import payments"}
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
              First row must be a header. Required columns: <code>dealNumber</code> OR{" "}
              <code>paymentId</code>; <code>milestoneLabel</code> (when using
              dealNumber); <code>amount</code>; <code>paidDate</code> (ISO datetime
              or <code>YYYY-MM-DD</code>); <code>paymentMethod</code>.
            </p>
            <p>
              Optional columns: <code>receiptKey</code>, <code>notes</code>.
            </p>
            <p>
              Rules: <code>amount === payment.amount</code> marks the payment as
              fully paid; <code>amount &lt; payment.amount</code> records a partial
              payment; <code>amount &gt; payment.amount</code> rejects the row.
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">{SAMPLE_HEADER}</pre>
          </div>
        </details>

        {/* ---- Results ---- */}
        {result && (
          <section className="space-y-4">
            <div className="rounded-md border border-border bg-card p-4 text-sm">
              <p>
                <strong>Total rows:</strong> {result.totalRows} ·{" "}
                <span className="text-success">{result.successCount} ok</span> ·{" "}
                <span className="text-destructive">{result.errorCount} error(s)</span>
              </p>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Deal</th>
                    <th className="px-3 py-2 text-left font-medium">Milestone</th>
                    <th className="px-3 py-2 text-left font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {result.successes.map((s) => (
                    <tr key={`s-${s.row}`} className="bg-success-soft">
                      <td className="px-3 py-2">{s.row}</td>
                      <td className="px-3 py-2 font-medium text-success">
                        {s.action === "MARKED_PAID" ? "PAID" : "PARTIAL"}
                      </td>
                      <td className="px-3 py-2">{s.dealNumber ?? "—"}</td>
                      <td className="px-3 py-2">{s.milestoneLabel ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{s.paymentId}</td>
                    </tr>
                  ))}
                  {result.errors.map((err) => (
                    <tr key={`e-${err.row}`} className="bg-destructive-soft">
                      <td className="px-3 py-2">{err.row}</td>
                      <td className="px-3 py-2 font-medium text-destructive">ERROR</td>
                      <td className="px-3 py-2">{err.dealNumber ?? "—"}</td>
                      <td className="px-3 py-2">{err.milestoneLabel ?? "—"}</td>
                      <td className="px-3 py-2 text-destructive">{err.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </PageContainer>
      </div>
    </div>
  );
}
