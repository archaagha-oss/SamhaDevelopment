import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface ReceiptData {
  dealNumber: string;
  milestoneLabel: string;
  amount: number;
  paidDate: string;
  paymentMethod: string;
  receiptKey?: string;
  status: string;
  buyerDetails: { name: string; phone: string; email?: string };
  unitDetails: { unitNumber: string; type: string; floor: number };
  projectDetails: { name: string; location: string };
  version?: number;
  generatedAt?: string;
}

const fmtAED  = (n: number) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
const today   = () => new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });

const TYPE_LABEL: Record<string, string> = {
  STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
  THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Bank Transfer", CASH: "Cash", CHEQUE: "Cheque",
  CRYPTO: "Crypto", CARD: "Card", PDC: "PDC",
};

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex justify-between py-2.5 border-b border-slate-100 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className={bold ? "font-bold text-slate-900" : "font-semibold text-slate-800"}>{value}</span>
  </div>
);

export default function ReceiptPrintPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [data, setData]             = useState<ReceiptData | null>(null);
  const [docVersion, setDocVersion] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const docId        = searchParams.get("docId");
  const autoPrint    = searchParams.get("auto") === "print";

  useEffect(() => {
    if (!paymentId) return;

    if (docId) {
      axios.get(`/api/payments/${paymentId}/documents/${docId}`)
        .then((r) => {
          const doc = r.data;
          setDocVersion(doc.version ?? null);
          setData({ ...(doc.dataSnapshot as ReceiptData), generatedAt: doc.uploadedAt });
        })
        .catch((e) => setError(e.response?.data?.error || "Document not found"))
        .finally(() => setLoading(false));
    } else {
      axios.get(`/api/payments/${paymentId}`)
        .then((r) => {
          const p = r.data;
          setData({
            dealNumber:     p.deal?.dealNumber ?? "",
            milestoneLabel: p.milestoneLabel,
            amount:         p.amount,
            paidDate:       p.paidDate,
            paymentMethod:  p.paymentMethod ?? "",
            receiptKey:     p.receiptKey ?? undefined,
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
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !data) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <p className="text-red-600">{error || "Receipt not found"}</p>
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Toolbar */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 shadow-lg">
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
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-emerald-700">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PAYMENT RECEIPT</h1>
            <p className="text-sm text-slate-500 mt-1">{data.projectDetails.name} — {data.projectDetails.location}</p>
          </div>
          <div className="text-right text-sm text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Date: {today()}</p>
            <p className="font-mono text-xs text-slate-400">{data.dealNumber}</p>
            {data.paidDate && (
              <p className="text-xs font-medium text-emerald-700">Paid: {fmtDate(data.paidDate)}</p>
            )}
          </div>
        </div>

        {/* Confirmation badge */}
        <div className="mb-6 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <span className="text-emerald-600 text-xl">✓</span>
          <div>
            <p className="text-sm font-bold text-emerald-800">Payment Confirmed</p>
            <p className="text-xs text-emerald-600">This receipt confirms that the payment below has been received.</p>
          </div>
        </div>

        {/* Buyer */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Received From</h2>
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
            <Row label="Unit"    value={data.unitDetails.unitNumber} bold />
            <Row label="Type"    value={TYPE_LABEL[data.unitDetails.type] ?? data.unitDetails.type} />
            <Row label="Floor"   value={`Floor ${data.unitDetails.floor}`} />
            <Row label="Project" value={data.projectDetails.name} />
          </div>
        </div>

        {/* Payment details */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Payment Details</h2>
          <div className="bg-slate-50 rounded-xl p-4">
            <Row label="Description"     value={data.milestoneLabel} />
            <Row label="Payment Method"  value={METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod} />
            {data.paidDate && <Row label="Payment Date" value={fmtDate(data.paidDate)} />}
            {data.receiptKey && <Row label="Reference" value={data.receiptKey} />}
            <div className="flex justify-between pt-3 mt-1 border-t-2 border-emerald-200 text-sm">
              <span className="font-bold text-slate-700 text-base">Amount Received</span>
              <span className="font-bold text-emerald-700 text-base">{fmtAED(data.amount)}</span>
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-6">Authorized By</p>
            <div className="border-b border-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Developer Representative</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-6">Received By</p>
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
