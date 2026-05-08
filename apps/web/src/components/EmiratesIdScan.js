import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { runEmiratesIdOcr } from "../utils/emiratesIdOcr";
export default function EmiratesIdScan({ onExtracted, className }) {
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const handleFile = async (file) => {
        setError(null);
        setBusy(true);
        setProgress(0);
        try {
            const fields = await runEmiratesIdOcr(file, (p) => {
                if (p.status === "recognizing text")
                    setProgress(p.progress);
            });
            onExtracted(fields);
        }
        catch (e) {
            setError(e?.message || "Failed to read Emirates ID");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: className, children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer text-xs text-blue-700 font-semibold hover:text-blue-900", children: [_jsx("span", { className: "px-2 py-1 rounded-md border border-blue-200 bg-blue-50", children: busy ? `Scanning… ${Math.round(progress * 100)}%` : "Scan Emirates ID" }), _jsx("input", { type: "file", accept: "image/*", className: "hidden", disabled: busy, onChange: (e) => {
                            const f = e.target.files?.[0];
                            if (f)
                                handleFile(f);
                            e.target.value = "";
                        } })] }), error && (_jsx("p", { className: "text-xs text-red-600 mt-1", children: error })), _jsx("p", { className: "text-[10px] text-slate-400 mt-1", children: "Runs locally in your browser \u2014 no upload. Confirm fields after scanning." })] }));
}
