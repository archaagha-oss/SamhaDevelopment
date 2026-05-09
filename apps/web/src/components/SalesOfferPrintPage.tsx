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
  <div className="flex justify-between py-2.5 border-b border-border text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={bold ? "font-bold text-foreground" : "font-semibold text-foreground"}>{value}</span>
  </div>
);

// Map a stored dataSnapshot (immutable) back to the DealDetail render interface.
function snapshotToDeal(snap: any): DealDetail {
  const buyerName: string = snap.buyerDetails?.name ?? "";
  const spaceIdx = buyerName.indexOf(" ");
  const firstName = spaceIdx === -1 ? buyerName : buyerName.slice(0, spaceIdx);
  const lastName  = spaceIdx === -1 ? ""         : buyerName.slice(spaceIdx + 1);
  return {
    id:              snap.dealId ?? "",
    dealNumber:      snap.dealNumber ?? "",
    salePrice:       snap.salePrice  ?? 0,
    discount:        snap.discount   ?? 0,
    dldFee:          snap.dldFee     ?? 0,
    adminFee:        snap.adminFee   ?? 0,
    reservationDate: snap.reservationDate ?? "",
    stage:           "RESERVATION_CONFIRMED",
    lead: {
      firstName,
      lastName,
      phone:       snap.buyerDetails?.phone       ?? "",
      email:       snap.buyerDetails?.email,
      nationality: snap.buyerDetails?.nationality,
    },
    unit: {
      unitNumber:   snap.unitDetails?.unitNumber   ?? "",
      type:         snap.unitDetails?.type         ?? "",
      floor:        snap.unitDetails?.floor        ?? 0,
      area:         snap.unitDetails?.area         ?? 0,
      view:         snap.unitDetails?.view,
      bathrooms:    snap.unitDetails?.bathrooms,
      parkingSpaces: snap.unitDetails?.parkingSpaces,
      project: {
        name:         snap.projectDetails?.name     ?? "",
        location:     snap.projectDetails?.location ?? "",
        handoverDate: snap.projectDetails?.handoverDate,
      },
    },
    paymentPlan: snap.paymentPlan?.name ? { name: snap.paymentPlan.name } : null,
  };
}

export default function SalesOfferPrintPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [deal, setDeal]         = useState<DealDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [docVersion, setDocVersion] = useState<number | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const docId  = searchParams.get("docId");
  const autoPrint = searchParams.get("auto") === "print";

  useEffect(() => {
    if (!dealId) return;

    if (docId) {
      // Historical version — render from the immutable dataSnapshot
      axios.get(`/api/deals/${dealId}/documents/${docId}`)
        .then((r) => {
          const doc = r.data;
          setDocVersion(doc.version ?? null);
          setDeal(snapshotToDeal(doc.dataSnapshot ?? {}));
        })
        .catch((e) => setError(e.response?.data?.error || "Document not found"))
        .finally(() => setLoading(false));
    } else {
      // Latest — fetch current deal state
      axios.get(`/api/deals/${dealId}`)
        .then((r) => setDeal(r.data))
        .catch((e) => setError(e.response?.data?.error || "Failed to load deal"))
        .finally(() => setLoading(false));
    }
  }, [dealId, docId]);

  // Auto-trigger print dialog when opened with ?auto=print
  useEffect(() => {
    if (!deal || !autoPrint) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [deal, autoPrint]);

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
  const netPrice      = deal.salePrice - deal.discount;
  const totalWithFees = netPrice + deal.dldFee + deal.adminFee;

  return (
    <div className="bg-card min-h-screen">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 shadow-lg"
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

      {/* Historical version notice */}
      {docVersion !== null && (
        <div className="print:hidden fixed top-4 left-4 z-50">
          <span className="px-3 py-1.5 text-xs font-semibold bg-warning-soft text-warning border border-warning/30 rounded-lg shadow">
            Viewing v{docVersion} — data frozen at generation time
          </span>
        </div>
      )}

      {/* Page */}
      <div className="max-w-2xl mx-auto px-8 py-12 print:py-8 print:px-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-primary/40">
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-tight">Sales Offer</h1>
            <p className="text-sm text-muted-foreground mt-1">{unit.project.name} — {unit.project.location}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Date: {today()}</p>
            <p className="font-mono text-xs text-muted-foreground">{deal.dealNumber}</p>
            {docVersion !== null && (
              <p className="text-xs font-semibold text-warning">Version {docVersion}</p>
            )}
          </div>
        </div>

        {/* Buyer */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Buyer Details</h2>
          <div className="bg-muted/50 rounded-xl p-4 space-y-0">
            <Row label="Full Name"    value={`${lead.firstName} ${lead.lastName}`} />
            <Row label="Phone"        value={lead.phone} />
            {lead.email      && <Row label="Email"       value={lead.email} />}
            {lead.nationality && <Row label="Nationality" value={lead.nationality} />}
          </div>
        </div>

        {/* Unit */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Unit Details</h2>
          <div className="bg-muted/50 rounded-xl p-4 space-y-0">
            <Row label="Unit Number"    value={unit.unitNumber} bold />
            <Row label="Property Type"  value={TYPE_LABEL[unit.type] ?? unit.type} />
            <Row label="Floor"          value={`Floor ${unit.floor}`} />
            <Row label="Total Area"     value={`${unit.area.toLocaleString()} sq.ft`} />
            {unit.view          && <Row label="View"      value={unit.view} />}
            {unit.bathrooms     && <Row label="Bathrooms" value={String(unit.bathrooms)} />}
            {unit.parkingSpaces && <Row label="Parking"   value={String(unit.parkingSpaces)} />}
            {unit.project.handoverDate && (
              <Row label="Estimated Handover" value={fmtDate(unit.project.handoverDate)} />
            )}
            {deal.paymentPlan && <Row label="Payment Plan" value={deal.paymentPlan.name} />}
          </div>
        </div>

        {/* Pricing */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Pricing Summary</h2>
          <div className="bg-muted/50 rounded-xl p-4 space-y-0">
            <Row label="Listed Price"   value={fmtAED(deal.salePrice)} />
            {deal.discount > 0 && (
              <div className="flex justify-between py-2.5 border-b border-border text-sm">
                <span className="text-success">Discount</span>
                <span className="font-semibold text-success">- {fmtAED(deal.discount)}</span>
              </div>
            )}
            <Row label="Net Sale Price" value={fmtAED(netPrice)} bold />
            <Row label="DLD Fee (4%)"   value={fmtAED(deal.dldFee)} />
            <Row label="Admin Fee"      value={fmtAED(deal.adminFee)} />
            <div className="flex justify-between pt-3 mt-1 border-t-2 border-border text-sm">
              <span className="font-bold text-foreground text-base">Total (inc. Fees)</span>
              <span className="font-bold text-primary text-base">{fmtAED(totalWithFees)}</span>
            </div>
          </div>
        </div>

        {/* Validity note */}
        <div className="bg-info-soft border border-primary/40 rounded-xl p-4 text-sm text-primary mb-8">
          This offer is valid for 7 days from the date of issue. Unit availability is subject to change until
          a reservation agreement is signed and a reservation deposit is received.
        </div>

        {/* Signature block */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-6">Authorized Signature</p>
            <div className="border-b border-border mb-2" />
            <p className="text-xs text-muted-foreground">Developer Representative</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-6">Buyer Acknowledgment</p>
            <div className="border-b border-border mb-2" />
            <p className="text-xs text-muted-foreground">{lead.firstName} {lead.lastName}</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-foreground/80 mt-10 print:mt-6">
          Generated on {today()} · {deal.dealNumber}{docVersion !== null ? ` · v${docVersion}` : ""}
        </p>
      </div>

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
