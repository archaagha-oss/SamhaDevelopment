import { useState } from "react";
import { runEmiratesIdOcr, EmiratesIdFields } from "../utils/emiratesIdOcr";

interface Props {
  onExtracted: (fields: EmiratesIdFields) => void;
  className?: string;
}

export default function EmiratesIdScan({ onExtracted, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    setProgress(0);
    try {
      const fields = await runEmiratesIdOcr(file, (p) => {
        if (p.status === "recognizing text") setProgress(p.progress);
      });
      onExtracted(fields);
    } catch (e: any) {
      setError(e?.message || "Failed to read Emirates ID");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <label className="flex items-center gap-2 cursor-pointer text-xs text-primary font-semibold hover:text-primary">
        <span className="px-2 py-1 rounded-md border border-primary/40 bg-info-soft">
          {busy ? `Scanning… ${Math.round(progress * 100)}%` : "Scan Emirates ID"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">
        Runs locally in your browser — no upload. Confirm fields after scanning.
      </p>
    </div>
  );
}
