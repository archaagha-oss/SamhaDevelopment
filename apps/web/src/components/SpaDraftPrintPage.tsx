import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface DealDetail {
  id: string;
  dealNumber: string;
  salePrice: number;
  discount: number;
  reservationAmount: number;
  dldFee: number;
  adminFee: number;
  reservationDate: string;
  oqoodDeadline: string;
  stage: string;
  lead: {
    firstName: string; lastName: string; phone: string; email?: string; nationality?: string;
  };
  unit: {
    unitNumber: string; type: string; floor: number; area: number;
    view: string; bathrooms?: number; parkingSpaces?: number;
    internalArea?: number; externalArea?: number;
    project: { name: string; location: string; handoverDate?: string };
  };
  paymentPlan: { name: string };
  payments: { milestoneLabel: string; amount: number; dueDate: string; percentage: number; status: string }[];
}

const fmtAED = (n: number) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0 });
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });

const TYPE_LABEL: Record<string, string> = {
  STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
  THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};

const ROW = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-slate-800">{value}</span>
  </div>
);

export default function SpaDraftPrintPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    axios.get(`/api/deals/${dealId}`)
      .then((r) => setDeal(r.data))
      .catch((e) => setError(e.response?.data?.error || "Failed to load deal"))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !deal) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <p className="text-red-600">{error || "Deal not found"}</p>
    </div>
  );

  const { lead, unit } = deal;
  const netPrice = deal.salePrice - deal.discount;

  return (
    <div className="bg-white min-h-screen">
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 shadow-lg"
        >
          Download / Print PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 shadow-lg"
        >
          Close
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-10 py-16 print:p-0 print:max-w-none">
        {/* Header */}
        <div className="border-b-2 border-violet-700 pb-6 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-500 bg-violet-50 px-2 py-0.5 rounded">Draft</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Sale and Purchase Agreement</h1>
          <div className="flex items-center justify-between mt-2">
            <p className="text-slate-500 text-sm">{unit.project.name} — {unit.project.location}</p>
            <div className="text-right">
              <p className="text-xs text-slate-400">Reference</p>
              <p className="text-sm font-bold text-slate-700">{deal.dealNumber}</p>
            </div>
          </div>
        </div>

        {/* Parties */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Parties</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Seller / Developer</p>
              <p className="text-sm font-semibold text-slate-800">{unit.project.name}</p>
              <p className="text-xs text-slate-500 mt-1">{unit.project.location}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Buyer</p>
              <p className="text-sm font-semibold text-slate-800">{lead.firstName} {lead.lastName}</p>
              <p className="text-xs text-slate-500 mt-1">{lead.nationality || "—"}</p>
              <p className="text-xs text-slate-500">{lead.phone}</p>
              {lead.email && <p className="text-xs text-slate-500">{lead.email}</p>}
            </div>
          </div>
        </section>

        {/* Property */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Property Details</h2>
          <div className="grid grid-cols-2 gap-x-10">
            <ROW label="Unit Number" value={unit.unitNumber} />
            <ROW label="Type" value={TYPE_LABEL[unit.type] || unit.type} />
            <ROW label="Floor" value={String(unit.floor)} />
            <ROW label="Total Area" value={`${unit.area} sqm`} />
            {unit.internalArea != null && <ROW label="Suite Area" value={`${unit.internalArea} sqm`} />}
            {unit.externalArea != null && <ROW label="Balcony Area" value={`${unit.externalArea} sqm`} />}
            <ROW label="View" value={unit.view} />
            {unit.bathrooms != null && <ROW label="Bathrooms" value={String(unit.bathrooms)} />}
            {unit.parkingSpaces != null && <ROW label="Parking" value={String(unit.parkingSpaces)} />}
            {unit.project.handoverDate && <ROW label="Expected Handover" value={fmtDate(unit.project.handoverDate)} />}
          </div>
        </section>

        {/* Purchase price */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Purchase Price</h2>
          <div className="space-y-0">
            <ROW label="Sale Price" value={fmtAED(deal.salePrice)} />
            {deal.discount > 0 && <ROW label="Agreed Discount" value={`− ${fmtAED(deal.discount)}`} />}
            <ROW label="Net Sale Price" value={fmtAED(netPrice)} />
            <ROW label="DLD Registration Fee (4%)" value={fmtAED(deal.dldFee)} />
            <ROW label="Admin Fee" value={fmtAED(deal.adminFee)} />
            <div className="flex justify-between py-3 border-b-2 border-slate-800 text-base font-bold mt-1">
              <span className="text-slate-800">Total Purchase Price</span>
              <span className="text-slate-900">{fmtAED(netPrice + deal.dldFee + deal.adminFee)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm mt-1">
              <span className="text-slate-500">Reservation Deposit Paid</span>
              <span className="font-bold text-emerald-700">{fmtAED(deal.reservationAmount)}</span>
            </div>
          </div>
        </section>

        {/* Payment schedule */}
        {deal.payments && deal.payments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Payment Schedule</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">Milestone</th>
                  <th className="text-right py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">%</th>
                  <th className="text-right py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th className="text-right py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {deal.payments.map((p, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 text-slate-700">{p.milestoneLabel}</td>
                    <td className="py-2 text-right text-slate-500">{p.percentage.toFixed(1)}%</td>
                    <td className="py-2 text-right font-semibold text-slate-800">{fmtAED(p.amount)}</td>
                    <td className="py-2 text-right text-slate-500">{fmtDate(p.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Key dates */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Key Dates</h2>
          <div className="grid grid-cols-2 gap-x-10">
            <ROW label="Reservation Date" value={fmtDate(deal.reservationDate)} />
            <ROW label="Oqood Deadline" value={fmtDate(deal.oqoodDeadline)} />
            {unit.project.handoverDate && <ROW label="Expected Handover" value={fmtDate(unit.project.handoverDate)} />}
          </div>
        </section>

        {/* Signatures */}
        <section className="mt-14 grid grid-cols-2 gap-16">
          <div>
            <div className="border-b border-slate-300 h-12 mb-2" />
            <p className="text-xs text-slate-500">Seller Signature & Date</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">{unit.project.name}</p>
          </div>
          <div>
            <div className="border-b border-slate-300 h-12 mb-2" />
            <p className="text-xs text-slate-500">Buyer Signature & Date</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">{lead.firstName} {lead.lastName}</p>
          </div>
        </section>

        <p className="text-xs text-slate-400 mt-10 text-center border-t border-slate-100 pt-6">
          This is a DRAFT document for review purposes only. The executed SPA will supersede this document.
          Generated on {fmtDate(new Date().toISOString())} · Ref: {deal.dealNumber}
        </p>
      </div>

      <style>{`
        @media print {
          @page { margin: 15mm; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:max-w-none { max-width: none !important; }
          table, tr, .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
