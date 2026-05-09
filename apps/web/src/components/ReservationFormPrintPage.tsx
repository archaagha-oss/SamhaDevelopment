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
}

const fmtAED = (n: number) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0 });
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });

const TYPE_LABEL: Record<string, string> = {
  STUDIO: "Studio", ONE_BR: "1 Bedroom", TWO_BR: "2 Bedrooms",
  THREE_BR: "3 Bedrooms", FOUR_BR: "4 Bedrooms", COMMERCIAL: "Commercial",
};

const ROW = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-2 border-b border-border text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold text-foreground">{value}</span>
  </div>
);

export default function ReservationFormPrintPage() {
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
    <div className="flex items-center justify-center min-h-screen bg-card">
      <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !deal) return (
    <div className="flex items-center justify-center min-h-screen bg-card">
      <p className="text-destructive">{error || "Deal not found"}</p>
    </div>
  );

  const { lead, unit } = deal;
  const netPrice = deal.salePrice - deal.discount;

  return (
    <div className="bg-card min-h-screen">
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 shadow-lg"
        >
          Download / Print PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted shadow-lg"
        >
          Close
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-10 py-16 print:p-0 print:max-w-none">
        {/* Header */}
        <div className="border-b-2 border-border pb-6 mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Reservation Form</h1>
          <div className="flex items-center justify-between mt-2">
            <p className="text-muted-foreground text-sm">{unit.project.name} — {unit.project.location}</p>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="text-sm font-bold text-foreground">{deal.dealNumber}</p>
            </div>
          </div>
        </div>

        {/* Buyer details */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Buyer Details</h2>
          <div className="grid grid-cols-2 gap-x-10">
            <ROW label="Full Name" value={`${lead.firstName} ${lead.lastName}`} />
            <ROW label="Phone" value={lead.phone} />
            <ROW label="Email" value={lead.email || "—"} />
            <ROW label="Nationality" value={lead.nationality || "—"} />
          </div>
        </section>

        {/* Unit details */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Unit Details</h2>
          <div className="grid grid-cols-2 gap-x-10">
            <ROW label="Project" value={unit.project.name} />
            <ROW label="Unit Number" value={unit.unitNumber} />
            <ROW label="Type" value={TYPE_LABEL[unit.type] || unit.type} />
            <ROW label="Floor" value={String(unit.floor)} />
            <ROW label="Total Area" value={`${unit.area} sqm`} />
            <ROW label="View" value={unit.view} />
            {unit.bathrooms != null && <ROW label="Bathrooms" value={String(unit.bathrooms)} />}
            {unit.parkingSpaces != null && <ROW label="Parking" value={String(unit.parkingSpaces)} />}
            {unit.project.handoverDate && <ROW label="Handover" value={fmtDate(unit.project.handoverDate)} />}
          </div>
        </section>

        {/* Financial details */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Financial Details</h2>
          <div className="space-y-0">
            <ROW label="Sale Price" value={fmtAED(deal.salePrice)} />
            {deal.discount > 0 && <ROW label="Discount" value={`− ${fmtAED(deal.discount)}`} />}
            <ROW label="Net Price" value={fmtAED(netPrice)} />
            <ROW label="DLD Fee (4%)" value={fmtAED(deal.dldFee)} />
            <ROW label="Admin Fee" value={fmtAED(deal.adminFee)} />
            <div className="flex justify-between py-3 border-b border-border text-base font-bold mt-1">
              <span className="text-foreground">Total Payable</span>
              <span className="text-foreground">{fmtAED(netPrice + deal.dldFee + deal.adminFee)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm mt-1">
              <span className="text-muted-foreground">Reservation Amount Paid</span>
              <span className="font-bold text-success">{fmtAED(deal.reservationAmount)}</span>
            </div>
          </div>
        </section>

        {/* Payment plan + dates */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Payment & Dates</h2>
          <div className="grid grid-cols-2 gap-x-10">
            <ROW label="Payment Plan" value={deal.paymentPlan?.name || "—"} />
            <ROW label="Reservation Date" value={fmtDate(deal.reservationDate)} />
            <ROW label="Oqood Deadline" value={fmtDate(deal.oqoodDeadline)} />
          </div>
        </section>

        {/* Signatures */}
        <section className="mt-12 grid grid-cols-2 gap-16">
          <div>
            <div className="border-b border-border h-10 mb-2" />
            <p className="text-xs text-muted-foreground">Buyer Signature & Date</p>
            <p className="text-sm font-semibold text-foreground mt-1">{lead.firstName} {lead.lastName}</p>
          </div>
          <div>
            <div className="border-b border-border h-10 mb-2" />
            <p className="text-xs text-muted-foreground">Developer / Agent Signature & Date</p>
          </div>
        </section>

        <p className="text-xs text-muted-foreground mt-10 text-center">
          This reservation form is subject to the terms and conditions of the Sale and Purchase Agreement.
          Generated on {fmtDate(new Date().toISOString())}.
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
