import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useSettings } from "../contexts/SettingsContext";
import { formatCurrency, formatDate } from "../utils/format";

interface InvoiceData {
  dealNumber: string;
  milestoneLabel: string;
  amount: number;
  dueDate: string;
  status: string;
  buyerDetails: { name: string; phone: string; email?: string };
  unitDetails: { unitNumber: string; type: string; floor: number };
  projectDetails: { name: string; location: string };
  paymentInstructions?: string | null;
  version?: number;
  generatedAt?: string;
}

const TYPE_LABEL: Record<string, string> = {
  STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
  THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex justify-between py-2.5 border-b border-slate-100 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className={bold ? "font-bold text-slate-900" : "font-semibold text-slate-800"}>{value}</span>
  </div>
);

export default function InvoicePrintPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { settings } = useSettings();
  const [data, setData]       = useState<InvoiceData | null>(null);
  const [docVersion, setDocVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fmtAmt  = (n: number) => formatCurrency(n, settings, { decimals: 0 });
  const fmtDate2 = (d: string) => formatDate(d, settings);
  const today   = () => formatDate(new Date(), settings);

  const searchParams  = new URLSearchParams(window.location.search);
  const docId         = searchParams.get("docId");
  const autoPrint     = searchParams.get("auto") === "print";

  useEffect(() => {
    if (!paymentId) return;

    if (docId) {
      // Load from stored dataSnapshot (historical version)
      axios.get(`/api/payments/${paymentId}/documents/${docId}`)
        .then((r) => {
          const doc = r.data;
          setDocVersion(doc.version ?? null);
          setData({ ...(doc.dataSnapshot as InvoiceData), generatedAt: doc.uploadedAt });
        })
        .catch((e) => setError(e.response?.data?.error || "Document not found"))
        .finally(() => setLoading(false));
    } else {
      // Load live payment data
      axios.get(`/api/payments/${paymentId}`)
        .then((r) => {
          const p = r.data;
          setData({
            dealNumber:     p.deal?.dealNumber ?? "",
            milestoneLabel: p.milestoneLabel,
            amount:         p.amount,
            dueDate:        p.dueDate,
            status:         p.status,
            buyerDetails:   { name: `${p.deal?.lead?.firstName ?? ""} ${p.deal?.lead?.lastName ?? ""}`.trim(), phone: p.deal?.lead?.phone ?? "", email: p.deal?.lead?.email },
            unitDetails:    { unitNumber: p.deal?.unit?.unitNumber ?? "", type: p.deal?.unit?.type ?? "", floor: p.deal?.unit?.floor ?? 0 },
            projectDetails: { name: p.deal?.unit?.project?.name ?? "", location: p.deal?.unit?.project?.location ?? "" },
          });
        })
        .catch((e) => setError(e.response?.data?.error || "Failed to load payment"))
        .finally(() => setLoading(false));
    }
  }, [paymentId, docId]);

  useEffect(() => {
    if (!data || !autoPrint) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [data, autoPrint]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !data) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <p className="text-red-600">{error || "Invoice not found"}</p>
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Toolbar */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-lg">
          Download / Print
        </button>
        <button onClick={() => window.close()}
          className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 shadow-lg">
          Close
        </button>
      </div>

      {docVersion !== null && (
        <div className="print:hidden fixed top-4 left-4 z-50">
          <span className="px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300 rounded-lg shadow">
            Viewing v{docVersion} — frozen at generation time
          </span>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-8 py-12 print:py-8 print:px-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-800">
          <div className="flex items-start gap-3">
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="" className="h-12 w-12 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            )}
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">INVOICE</h1>
              {settings.companyName && <p className="text-xs font-semibold text-slate-700 mt-1">{settings.companyName}</p>}
              <p className="text-sm text-slate-500 mt-0.5">{data.projectDetails.name} — {data.projectDetails.location}</p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Date: {today()}</p>
            <p className="font-mono text-xs text-slate-400">{data.dealNumber}</p>
            <p className="text-xs font-medium text-slate-600">Due: {fmtDate2(data.dueDate)}</p>
          </div>
        </div>

        {/* Buyer */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bill To</h2>
          <div className="bg-slate-50 rounded-xl p-4">
            <Row label="Buyer Name" value={data.buyerDetails.name} bold />
            <Row label="Phone"      value={data.buyerDetails.phone} />
            {data.buyerDetails.email && <Row label="Email" value={data.buyerDetails.email} />}
          </div>
        </div>

        {/* Unit */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Property Details</h2>
          <div className="bg-slate-50 rounded-xl p-4">
            <Row label="Unit"          value={data.unitDetails.unitNumber} bold />
            <Row label="Type"          value={TYPE_LABEL[data.unitDetails.type] ?? data.unitDetails.type} />
            <Row label="Floor"         value={`Floor ${data.unitDetails.floor}`} />
            <Row label="Project"       value={data.projectDetails.name} />
          </div>
        </div>

        {/* Invoice line */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Invoice Details</h2>
          <div className="bg-slate-50 rounded-xl p-4">
            <Row label="Description" value={data.milestoneLabel} />
            <Row label="Due Date"    value={fmtDate2(data.dueDate)} />
            <div className="flex justify-between pt-3 mt-1 border-t-2 border-slate-200 text-sm">
              <span className="font-bold text-slate-700 text-base">Amount Due</span>
              <span className="font-bold text-slate-900 text-base">{fmtAmt(data.amount)}</span>
            </div>
          </div>
        </div>

        {/* Payment instructions */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 mb-8">
          <p className="font-semibold text-slate-700 mb-2">Payment Instructions</p>
          {data.paymentInstructions ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600">{data.paymentInstructions}</pre>
          ) : (
            <>
              <p>Please transfer the amount due to our designated bank account before the due date.</p>
              <p className="mt-1 text-xs text-slate-400">Quote your unit number and deal reference when making the transfer.</p>
            </>
          )}
        </div>

        {/* Signature */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-6">Authorized By</p>
            <div className="border-b border-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Developer Representative</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-6">Acknowledged By</p>
            <div className="border-b border-slate-300 mb-2" />
            <p className="text-xs text-slate-400">{data.buyerDetails.name}</p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-300 mt-10 print:mt-6">
          Generated {today()} · {data.dealNumber}{docVersion !== null ? ` · v${docVersion}` : ""}
        </p>
      </div>
    </div>
  );
}
