import { ReactNode, useState, useEffect, useRef } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Spinner } from "./Spinner";
import { inputClasses } from "./Field";

interface Props<T> {
  value: T;
  /** Called with the next value. Throw / return a Promise that rejects to keep the editor open. */
  onSave: (next: T) => void | Promise<void>;
  /** Render the read-only display. Defaults to `String(value)`. */
  display?: (value: T) => ReactNode;
  /** Render the editor. Receives current value, setter, and submit handler. */
  edit?: (value: T, setValue: (v: T) => void, submit: () => void) => ReactNode;
  /** Disable editing entirely (read-only). */
  readOnly?: boolean;
  className?: string;
  /** Tooltip on the edit button. */
  label?: string;
}

/**
 * Click-to-edit pattern. Shows the value with a hover-revealed pencil
 * button; clicking enters edit mode with Save / Cancel.
 *
 *   <InlineEdit
 *     value={lead.budget}
 *     onSave={(v) => updateLead.mutateAsync({ budget: v })}
 *     display={(v) => formatAED(v)}
 *     edit={(v, setV, submit) => (
 *       <input className={inputClasses} type="number"
 *         value={v} onChange={(e) => setV(Number(e.target.value))}
 *         onKeyDown={(e) => e.key === "Enter" && submit()} />
 *     )}
 *   />
 */
export function InlineEdit<T>({
  value, onSave, display, edit, readOnly = false, className = "", label = "Edit",
}: Props<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(value);
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  // Click-outside to cancel
  useEffect(() => {
    if (!editing) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [editing]);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // Keep editor open so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing && edit) {
    return (
      <div ref={wrapperRef} className={`inline-flex items-center gap-1.5 ${className}`}>
        <div className="min-w-0 flex-1">{edit(draft, setDraft, submit)}</div>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          aria-label="Save"
          className="inline-flex items-center justify-center h-7 w-7 rounded-ctrl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {saving ? <Spinner size="xs" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label="Cancel"
          className="inline-flex items-center justify-center h-7 w-7 rounded-ctrl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 group ${className}`}>
      <span>{display ? display(value) : String(value ?? "—")}</span>
      {!readOnly && edit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={label}
          title={label}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

/** Convenience: a default-styled text input for use inside `edit={}`. */
export function inlineInputClasses(small = false) {
  return `${inputClasses} ${small ? "py-1 text-xs" : "py-1.5 text-sm"}`;
}
