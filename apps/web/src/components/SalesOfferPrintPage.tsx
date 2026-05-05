import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface DealDetail {
  id: string;
  dealNumber: string;
  salePrice: number;
  discount: number;
  dldFee: number;
  adminFee: number;
  reservationDate: string;
  stage: string;
  lead: {
    firstName: string; lastName: string; phone: string; email?: string; nationality?: string;
  };
  unit: {
    unitNumber: string; type: string; floor: number; area: number;
    view?: string; bathrooms?: number; parkingSpaces?: number;
    project: { name: string; location: string; handoverDate?: string };
  };
  paymentPlan?: { name: string } | null;
}

const fmtAED   = (n: number) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0 });
const fmtDate  = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
const today    = () => new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });

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

export default function SalesOfferPrintPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [deal, setDeal]     = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    axios.get(`/api/deals/${dealId}`)
      .then((r) => setDeal(r.data))
      .catch((e) => setError(e.response?.data?.error || "Failed to load deal"))
      .finally(() => setLoading(false));
  }, [dealId]);

  // Auto-trigger print dialog when opened with ?auto=print
  useEffect(() => {
    if (!deal) return;
    if (new URLSearchParams(window.location.search).get("auto") === "print") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [deal]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !deal) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <p className="text-red-600">{error || "Deal not found"}</p>
    </div>
  );

  const { lead, unit } = deal;
  const netPrice      = deal.salePrice - deal.discount;
  const totalWithFees = netPrice + deal.dldFee + deal.adminFee;

  return (
    <div className="bg-white min-h-screen">
      {/* Print button — hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-lg"
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

      {/* Page */}
      <div className="max-w-2xl mx-auto px-8 py-12 print:py-8 print:px-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-blue-600">
          <div>
            <h1 className="text-3xl font-bold text-blue-700 tracking-tight">Sales Offer</h1>
            <p className="text-sm text-slate-500 mt-1">{unit.project.name} — {unit.project.location}</p>
          </div>
          <div className="text-right text-sm text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Date: {today()}</p>
            <p className="font-mono text-xs text-slate-400">{deal.dealNumber}</p>
          </div>
        </div>

        {/* Buyer */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Buyer Details</h2>
          <div className="bg-slate-50 rounded-xl p-4 space-y-0">
            <Row label="Full Name"    value={`${lead.firstName} ${lead.lastName}`} />
            <Row label="Phone"        value={lead.phone} />
            {lead.email      && <Row label="Email"       value={lead.email} />}
            {lead.nationality && <Row label="Nationality" value={lead.nationality} />}
          </div>
        </div>

        {/* Unit */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Unit Details</h2>
          <div className="bg-slate-50 rounded-xl p-4 space-y-0">
            <Row label="Unit Number"    value={unit.unitNumber} bold />
            <Row label="Property Type"  value={TYPE_LABEL[unit.type] ?? unit.type} />
            <Row label="Floor"          value={`Floor ${unit.floor}`} />
            <Row label="Total Area"     value={`${unit.area.toLocaleString()} sq.ft`} />
            {unit.view         && <Row label="View"          value={unit.view} />}
            {unit.bathrooms    && <Row label="Bathrooms"     value={String(unit.bathrooms)} />}
            {unit.parkingSpaces && <Row label="Parking"      value={String(unit.parkingSpaces)} />}
            {unit.project.handoverDate && (
              <Row label="Estimated Handover" value={fmtDate(unit.project.handoverDate)} />
            )}
            {deal.paymentPlan && <Row label="Payment Plan" value={deal.paymentPlan.name} />}
          </div>
        </div>

        {/* Pricing */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Pricing Summary</h2>
          <div className="bg-slate-50 rounded-xl p-4 space-y-0">
            <Row label="Listed Price"   value={fmtAED(deal.salePrice)} />
            {deal.discount > 0 && (
              <div className="flex justify-between py-2.5 border-b border-slate-100 text-sm">
                <span className="text-emerald-600">Discount</span>
                <span className="font-semibold text-emerald-600">- {fmtAED(deal.discount)}</span>
              </div>
            )}
            <Row label="Net Sale Price" value={fmtAED(netPrice)} bold />
            <Row label="DLD Fee (4%)"   value={fmtAED(deal.dldFee)} />
            <Row label="Admin Fee"      value={fmtAED(deal.adminFee)} />
            <div className="flex justify-between pt-3 mt-1 border-t-2 border-slate-200 text-sm">
              <span className="font-bold text-slate-700 text-base">Total (inc. Fees)</span>
              <span className="font-bold text-blue-700 text-base">{fmtAED(totalWithFees)}</span>
            </div>
          </div>
        </div>

        {/* Validity note */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 mb-8">
          This offer is valid for 7 days from the date of issue. Unit availability is subject to change until
          a reservation agreement is signed and a reservation deposit is received.
        </div>

        {/* Signature block */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-6">Authorized Signature</p>
            <div className="border-b border-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Developer Representative</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-6">Buyer Acknowledgment</p>
            <div className="border-b border-slate-300 mb-2" />
            <p className="text-xs text-slate-400">{lead.firstName} {lead.lastName}</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-300 mt-10 print:mt-6">
          Generated on {today()} · {deal.dealNumber}
        </p>
      </div>
    </div>
  );
}
