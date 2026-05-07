import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface OfferDetail {
  id: string;
  offeredPrice: number;
  originalPrice: number;
  discountAmount: number;
  discountPct: number;
  status: string;
  expiresAt?: string;
  createdAt: string;
  lead: {
    firstName: string; lastName: string;
    phone: string; email?: string; nationality?: string; budget?: number;
  };
  unit: {
    unitNumber: string; type: string; floor: number; area: number;
    view: string; bathrooms?: number; parkingSpaces?: number;
    price: number; status: string;
    images: { id: string; url: string; caption?: string; type: string }[];
    project: { name: string; location: string; handoverDate?: string };
  };
}

const fmtAED = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });

const TYPE_LABEL: Record<string, string> = {
  STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
  THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};

export default function OfferPrintPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const [offer, setOffer]   = useState<OfferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!offerId) return;
    axios.get(`/api/offers/${offerId}`)
      .then((r) => setOffer(r.data))
      .catch((e) => setError(e.response?.data?.error || "Failed to load offer"))
      .finally(() => setLoading(false));
  }, [offerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-red-600">{error || "Offer not found"}</p>
      </div>
    );
  }

  const { lead, unit } = offer;
  const floorPlans = unit.images.filter((i) => i.type === "FLOOR_PLAN");
  const floorMaps  = unit.images.filter((i) => i.type === "FLOOR_MAP");

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
          className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 shadow-lg"
        >
          Close
        </button>
      </div>

      {/* Offer document */}
      <div className="max-w-3xl mx-auto px-8 py-10 print:p-0 print:max-w-none">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-900">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">SALES OFFER</h1>
            <p className="text-slate-500 text-sm mt-1">{unit.project.name} — {unit.project.location}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Offer Date</p>
            <p className="text-sm font-semibold text-slate-800">{fmtDate(offer.createdAt)}</p>
            {offer.expiresAt && (
              <>
                <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Valid Until</p>
                <p className="text-sm font-semibold text-red-600">{fmtDate(offer.expiresAt)}</p>
              </>
            )}
          </div>
        </div>

        {/* ── Client + Unit side by side ── */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Client */}
          <div className="bg-slate-50 rounded-xl p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Prepared For</p>
            <p className="text-lg font-bold text-slate-900">{lead.firstName} {lead.lastName}</p>
            <p className="text-sm text-slate-600 mt-1">{lead.phone}</p>
            {lead.email && <p className="text-sm text-slate-600">{lead.email}</p>}
            {lead.nationality && (
              <p className="text-xs text-slate-400 mt-2">Nationality: {lead.nationality}</p>
            )}
          </div>

          {/* Price summary */}
          <div className="bg-slate-900 rounded-xl p-5 text-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Offer Price</p>
            <p className="text-2xl font-black">{fmtAED(offer.offeredPrice)}</p>
            {offer.discountAmount > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-400">List Price: <span className="line-through">{fmtAED(offer.originalPrice)}</span></p>
                <p className="text-xs text-emerald-400 font-semibold">
                  Discount: {fmtAED(offer.discountAmount)} ({offer.discountPct.toFixed(1)}%)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Unit Details Table ── */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Unit Details</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {[
                  ["Project",        unit.project.name],
                  ["Unit Number",    unit.unitNumber],
                  ["Unit Type",      TYPE_LABEL[unit.type] ?? unit.type],
                  ["Floor",          `Floor ${unit.floor}`],
                  ["Area",           `${unit.area} sqm`],
                  ["View",           unit.view],
                  ...(unit.bathrooms    != null ? [["Bathrooms",    String(unit.bathrooms)]]    : []),
                  ...(unit.parkingSpaces != null ? [["Parking",     String(unit.parkingSpaces)]] : []),
                  ...(unit.project.handoverDate ? [["Handover",    fmtDate(unit.project.handoverDate)]] : []),
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="px-4 py-2.5 text-slate-500 font-medium w-40">{label}</td>
                    <td className="px-4 py-2.5 text-slate-900 font-semibold">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Floor Plans ── */}
        {floorPlans.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Floor Plan</h2>
            <div className={`grid gap-4 ${floorPlans.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {floorPlans.map((img) => (
                <div key={img.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <img src={img.url} alt={img.caption || "Floor Plan"} className="w-full object-contain max-h-72" />
                  {img.caption && (
                    <p className="text-xs text-center text-slate-500 py-1.5 bg-slate-50">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Floor Location Map ── */}
        {floorMaps.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Unit Location on Floor</h2>
            <p className="text-xs text-slate-500 mb-3">
              Floor {unit.floor} · Unit {unit.unitNumber}
            </p>
            <div className={`grid gap-4 ${floorMaps.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {floorMaps.map((img) => (
                <div key={img.id} className="border-2 border-amber-200 rounded-xl overflow-hidden">
                  <img src={img.url} alt={img.caption || "Floor Location Map"} className="w-full object-contain max-h-72" />
                  {img.caption && (
                    <p className="text-xs text-center text-slate-500 py-1.5 bg-amber-50">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            This offer is valid for 7 days from the date of issue unless otherwise specified.
            Prices are subject to change without prior notice.
          </p>
          <p className="text-xs text-slate-300 mt-2">Generated by Samha CRM · {fmtDate(new Date().toISOString())}</p>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page { margin: 15mm; }
          .print\\:hidden { display: none !important; }
          table, tr, .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
