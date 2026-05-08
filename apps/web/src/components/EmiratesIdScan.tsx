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
      <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-700 font-semibold hover:text-blue-900">
        <span className="px-2 py-1 rounded-md border border-blue-200 bg-blue-50">
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
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
      <p className="text-[10px] text-slate-400 mt-1">
        Runs locally in your browser — no upload. Confirm fields after scanning.
      </p>
    </div>
  );
}
