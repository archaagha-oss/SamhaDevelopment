import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { numberToWordsCapitalized } from "../utils/numberToWords";

// ---------------------------------------------------------------------------
// SPA snapshot shape — mirrors apps/api/src/services/spaService.ts
// (live preview reads /api/deals/:id/spa-snapshot which uses the same builder
// that produces the persisted Document.dataSnapshot)
// ---------------------------------------------------------------------------

interface BankAccount {
  accountName: string;
  bankName: string;
  branchAddress: string | null;
  iban: string;
  accountNumber: string;
  refPrefix: string | null;
}

interface SpaSnapshot {
  generatedAt: string;
  deal: {
    id: string;
    dealNumber: string;
    salePrice: number;
    discount: number;
    netSalePrice: number;
    reservationAmount: number;
    dldFee: number;
    adminFee: number;
    reservationDate: string;
    oqoodDeadline: string;
    anticipatedCompletionDate: string | null;
  };
  project: {
    id: string;
    name: string;
    location: string;
    description: string | null;
    handoverDate: string;
    commercialLicense: string | null;
    developerNumber: string | null;
    developerAddress: string | null;
    developerPhone: string | null;
    developerEmail: string | null;
    plotNumber: string | null;
    buildingPermitRef: string | null;
    buildingStructure: string | null;
    masterDeveloper: string | null;
    masterCommunity: string | null;
    permittedUse: string | null;
  };
  unit: {
    unitNumber: string;
    floor: number;
    type: string;
    view: string;
    area: number;
    areaSqft: number | null;
    ratePerSqft: number | null;
    smartHome: boolean | null;
    bathrooms: number | null;
    parkingSpaces: number | null;
    internalArea: number | null;
    externalArea: number | null;
  };
  purchasers: Array<{
    name: string;
    ownershipPercentage: number;
    address: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
    emiratesId: string | null;
    passportNumber: string | null;
    companyRegistrationNumber: string | null;
    authorizedSignatory: string | null;
    sourceOfFunds: string | null;
    isPrimary: boolean;
  }>;
  payments: Array<{
    label: string;
    percentage: number;
    amount: number;
    dueDate: string;
    anticipatedDateLabel: string;
    targetAccount: "ESCROW" | "CORPORATE";
    paymentReference: string | null;
  }>;
  bankAccounts: {
    escrow: BankAccount | null;
    current: BankAccount | null;
    escrowReference: string | null;
  };
  specifications: Array<{
    area: string;
    floorFinish: string | null;
    wallFinish: string | null;
    ceilingFinish: string | null;
    additionalFinishes: string | null;
  }>;
  schedules: {
    dimensionedPlanUrl: string | null;
    furnishedPlanUrl: string | null;
    floorPlanUrl: string | null;
  };
  rules: {
    lateFeeMonthlyPercent: number;
    delayCompensationAnnualPercent: number;
    delayCompensationCapPercent: number;
    liquidatedDamagesPercent: number;
    disposalThresholdPercent: number;
    resaleProcessingFee: number;
    gracePeriodMonths: number;
  };
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

const fmtAED = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtNumber = (n: number) =>
  n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

const SPEC_AREA_LABELS: Record<string, string> = {
  FOYER: "Foyer",
  LIVING_AREA: "Living Area",
  DINING_AREA: "Dining Area",
  BEDROOM: "Bedroom",
  KITCHEN: "Kitchen",
  MASTER_BATHROOM: "Master Bathroom",
  SECONDARY_BATHROOM: "Secondary Bathroom",
  BALCONY: "Balcony",
  POWDER_ROOM: "Powder Room",
  STUDY: "Study",
  MAID_ROOM: "Maid Room",
  LAUNDRY: "Laundry",
};

// ---------------------------------------------------------------------------
// Reusable layout primitives
// ---------------------------------------------------------------------------

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <tr className="border-b border-slate-200">
    <td className="py-2 px-3 text-sm text-slate-600 font-medium w-1/3 align-top">{label}</td>
    <td className="py-2 px-3 text-sm text-slate-900 align-top">{value ?? "—"}</td>
  </tr>
);

const Section = ({
  number,
  title,
  children,
}: {
  number?: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-6 break-inside-avoid">
    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-3 border-b border-slate-300 pb-1">
      {number ? <span className="text-slate-500 mr-2">{number}.</span> : null}
      {title}
    </h2>
    <div className="text-sm text-slate-800 leading-relaxed space-y-3">{children}</div>
  </section>
);

const Clause = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-slate-800 leading-relaxed">{children}</p>
);

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SpaDraftPrintPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [snap, setSnap] = useState<SpaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    axios
      .get<SpaSnapshot>(`/api/deals/${dealId}/spa-snapshot`)
      .then((r) => setSnap(r.data))
      .catch((e) => setError(e.response?.data?.error || "Failed to load deal"))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !snap) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-red-600">{error || "Deal not found"}</p>
      </div>
    );
  }

  const { project, unit, deal, purchasers, payments, bankAccounts, specifications, schedules, rules } =
    snap;
  const primary = purchasers.find((p) => p.isPrimary) ?? purchasers[0];

  const totalPurchaseInWords = numberToWordsCapitalized(deal.netSalePrice);
  const dldInWords = numberToWordsCapitalized(deal.dldFee);

  return (
    <div className="bg-white min-h-screen text-slate-900">
      {/* Print toolbar */}
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

      <div className="max-w-4xl mx-auto px-12 py-12 print:p-0 print:max-w-none">
        {/* Title page */}
        <div className="text-center py-16 mb-12 break-after-page">
          <h1 className="text-4xl font-bold tracking-tight mb-4">THE SALE AND PURCHASE AGREEMENT</h1>
          <div className="mt-12 text-lg">
            <div className="text-slate-500 text-sm uppercase tracking-widest mb-1">Project Name</div>
            <div className="font-bold">{project.name}</div>
          </div>
          <div className="mt-6 text-lg">
            <div className="text-slate-500 text-sm uppercase tracking-widest mb-1">Unit No</div>
            <div className="font-bold">{unit.unitNumber}</div>
          </div>
          <div className="mt-12 text-xs text-slate-400">
            Reference: {deal.dealNumber} · Generated {fmtDate(snap.generatedAt)}
          </div>
        </div>

        {/* Preamble */}
        <Clause>
          This Sale and Purchase Agreement (the &ldquo;Agreement&rdquo;) is made on{" "}
          <strong>{fmtDate(deal.reservationDate)}</strong> (the &ldquo;Effective Date&rdquo;) by and between:
        </Clause>

        {/* PARTICULARS */}
        <Section number="I" title="The Seller">
          <table className="w-full border border-slate-300 mt-2">
            <tbody>
              <Row label="Name" value={project.name.toUpperCase()} />
              <Row label="Commercial License Number" value={project.commercialLicense} />
              <Row label="Developer Number" value={project.developerNumber} />
              <Row label="Address" value={project.developerAddress} />
              <Row label="Tel. No" value={project.developerPhone} />
              <Row label="E-mail" value={project.developerEmail} />
            </tbody>
          </table>
        </Section>

        {/* Purchasers */}
        {purchasers.map((p, idx) => (
          <Section key={idx} title={`Purchaser ${idx + 1}`}>
            <table className="w-full border border-slate-300">
              <tbody>
                <Row label="Name" value={p.name} />
                <Row label="Ownership Percentage" value={`${p.ownershipPercentage}%`} />
                <Row label="Address" value={p.address} />
                <Row label="Tel. No / Mobile No" value={p.phone} />
                <Row label="E-mail" value={p.email} />
                <Row label="Nationality / Country of Incorporation" value={p.nationality} />
                {p.emiratesId && <Row label="Emirates ID" value={p.emiratesId} />}
                <Row
                  label="Passport / Company Registration No."
                  value={p.passportNumber || p.companyRegistrationNumber}
                />
                <Row label="Name of Authorized Signatory" value={p.authorizedSignatory || p.name} />
              </tbody>
            </table>
          </Section>
        ))}

        <Section number="III" title="Property Details">
          <p className="text-sm">The Property subject to this agreement is identified as:</p>
          <table className="w-full border border-slate-300">
            <tbody>
              <Row label="Project / Building Name" value={project.name} />
              <Row label="Plot No" value={project.plotNumber} />
              <Row label="Unit Number" value={unit.unitNumber} />
              <Row label="Floor Number" value={`${unit.floor}`} />
              <Row label="Address" value={project.location} />
              <Row
                label="Total Unit Area"
                value={
                  unit.areaSqft
                    ? `${fmtNumber(unit.area)} sq metres / ${fmtNumber(unit.areaSqft)} sq feet`
                    : `${fmtNumber(unit.area)} sq metres`
                }
              />
              {unit.ratePerSqft != null && (
                <Row label="Unit Rate per square foot" value={fmtNumber(unit.ratePerSqft)} />
              )}
              <Row
                label="Parking"
                value={unit.parkingSpaces ? `${unit.parkingSpaces} (parking bay${unit.parkingSpaces > 1 ? "s" : ""})` : "—"}
              />
            </tbody>
          </table>
        </Section>

        <Section number="IV" title="Anticipated Completion Date">
          <p className="text-sm font-semibold">{fmtDate(deal.anticipatedCompletionDate)}</p>
        </Section>

        <Section number="V" title="Permitted Use">
          <p className="text-sm font-semibold">
            {project.permittedUse || "Single Family Residential Purpose"}
          </p>
        </Section>

        <Section number="VI" title="Purchase Price">
          <table className="w-full border border-slate-300">
            <tbody>
              <Row label="Dirhams" value={fmtNumber(deal.netSalePrice)} />
              <Row label="In Words" value={totalPurchaseInWords} />
            </tbody>
          </table>
        </Section>

        <Section number="VII" title="Payment Schedule">
          <table className="w-full border border-slate-300 text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="py-2 px-3 text-left font-semibold">Instalment</th>
                <th className="py-2 px-3 text-right font-semibold">Instalment %</th>
                <th className="py-2 px-3 text-right font-semibold">Payment Amount (AED)</th>
                <th className="py-2 px-3 text-left font-semibold">Anticipated Date</th>
                <th className="py-2 px-3 text-left font-semibold">Account</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="py-2 px-3">{p.label}</td>
                  <td className="py-2 px-3 text-right">{p.percentage.toFixed(0)}%</td>
                  <td className="py-2 px-3 text-right font-semibold">{fmtNumber(p.amount)}</td>
                  <td className="py-2 px-3">{p.anticipatedDateLabel}</td>
                  <td className="py-2 px-3 capitalize">{p.targetAccount.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section number="VIII" title="Other Fees">
          <Clause>
            <strong>Transfer Registration Fees:</strong> 4% of the Purchase Price, or the latest fees charged
            by Dubai Land Department, to be paid by the Purchaser.
          </Clause>
          <Clause>
            <em>Note:</em> Manager&rsquo;s cheque to be issued in favour of Dubai Land Department for the
            current rate of 4% of the total purchase price (amounting to {fmtNumber(deal.dldFee)} ({dldInWords}{" "}
            only) as well as incidental charges towards pre-registration and any other costs or increases
            implemented by DLD from time to time, along with the Reservation Fees, or by any other payment
            method acceptable to the Dubai Land Department.
          </Clause>
        </Section>

        <Section number="IX" title="Escrow Account Details">
          {bankAccounts.escrow ? (
            <table className="w-full border border-slate-300">
              <tbody>
                <Row label="Account Name" value={bankAccounts.escrow.accountName} />
                <Row label="Bank Name" value={bankAccounts.escrow.bankName} />
                <Row label="Branch Address" value={bankAccounts.escrow.branchAddress} />
                <Row label="IBAN" value={bankAccounts.escrow.iban} />
                <Row label="Account Number" value={bankAccounts.escrow.accountNumber} />
                <Row label="Reference: Unit no" value={bankAccounts.escrowReference} />
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-amber-600 italic">
              Escrow account not configured for this project.
            </p>
          )}
        </Section>

        <Section number="X" title="Current Account Details">
          {bankAccounts.current ? (
            <table className="w-full border border-slate-300">
              <tbody>
                <Row label="Account Name" value={bankAccounts.current.accountName} />
                <Row label="Bank Name" value={bankAccounts.current.bankName} />
                <Row label="Branch Address" value={bankAccounts.current.branchAddress} />
                <Row label="IBAN" value={bankAccounts.current.iban} />
                <Row label="Account Number" value={bankAccounts.current.accountNumber} />
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-amber-600 italic">
              Current account not configured for this project.
            </p>
          )}
        </Section>

        {/* DEFINITIONS — abbreviated; the full glossary stays on a single page */}
        <Section title="Definitions">
          <Clause>
            In this Agreement unless the context otherwise requires, the following definitions apply:
          </Clause>
          <Clause>
            <strong>Administration Fee</strong> means the administrative fees payable by the Purchaser in
            accordance with this Agreement and subject to the Applicable Laws. The Seller&rsquo;s current
            Administration Fee is {fmtAED(deal.adminFee)} exclusive of any additional Registration Fees that
            may be payable in respect of the Disposal.
          </Clause>
          <Clause>
            <strong>AED / Applicable Currency</strong> means the Dirham, the lawful currency of the UAE.
          </Clause>
          <Clause>
            <strong>Agreement / SPA</strong> means this sale and purchase agreement entered into between the
            Seller and the Purchaser on the Effective Date, including any variation, schedules and agreement
            supplemental to this sale and purchase agreement.
          </Clause>
          <Clause>
            <strong>Anticipated Completion Date</strong> means the date upon which the Seller estimates that
            completion of the Building / Property Work is to occur, being the date specified in Particulars
            Item No. IV, as such date may be extended in accordance with this Agreement (including in respect
            of any Force Majeure Event).
          </Clause>
          <Clause>
            <strong>Applicable Laws</strong> means all laws, decrees, orders, decisions, instruments, notices,
            regulations, requirements, codes of practice, directions, guidance, permissions, consents or
            licenses issued by the Government of Dubai or a Relevant Authority that may at any time be
            applicable to this Agreement.
          </Clause>
          <Clause>
            <strong>Building</strong> means the entire building specified in Particulars Item No. III
            developed or to be developed by the Seller in accordance with the approvals from the Relevant
            Authorities.
          </Clause>
          <Clause>
            <strong>Common Areas</strong> means those parts of the building and the facilities contained
            therein not forming part of any unit and being capable of and intended for use in common.
          </Clause>
          <Clause>
            <strong>Completion Date</strong> means the date of completion of the Building / Property Works as
            notified to the Purchaser in the Completion Notice. The Completion Date may be before or after the
            Anticipated Completion Date and will override the same.
          </Clause>
          <Clause>
            <strong>Effective Date</strong> means the date this Agreement was entered into by the Parties.
          </Clause>
          <Clause>
            <strong>Escrow Account</strong> means the bank account specified in Particulars Item No. IX.
          </Clause>
          <Clause>
            <strong>Force Majeure Event</strong> means an act of God including fire, flood, earthquake,
            windstorm or other natural disaster; any act of any sovereign including terrorist attacks, war
            (whether declared or not), invasion, hostilities, civil war, rebellion, military action,
            confiscation, nationalization, or threat of any of the foregoing; refusal, delay and/or revocation
            of any required license or consent; any act, omission, negligence, failure and/or delay by a
            Relevant Authority; labour dispute including strike, lockout or boycott; insolvency of Contractor
            or any subcontractor with respect to the Building Works; and any other act, matter or cause
            whatsoever which is beyond the reasonable control of the Seller.
          </Clause>
          <Clause>
            <strong>Late Payment Fee</strong> means the penalty given by the Purchaser to the Seller at a rate
            of {rules.lateFeeMonthlyPercent}% per month of the overdue amount of the relevant instalment or
            charge, calculated daily and compounded monthly until full settlement is made.
          </Clause>
          <Clause>
            <strong>Master Community</strong> means the entire master community known as{" "}
            {project.masterCommunity || "—"} in which the building is located, developed by the Master
            Developer.
          </Clause>
          <Clause>
            <strong>Master Developer</strong> means {project.masterDeveloper || "—"}, its nominees, assigns
            and successors in title.
          </Clause>
          <Clause>
            <strong>RERA</strong> means the Real Estate Regulatory Agency in Dubai.
          </Clause>
        </Section>

        {/* SALE AND PURCHASE */}
        <Section number="1" title="Sale and Purchase">
          <Clause>
            Subject to the terms and conditions of this Agreement, the Seller hereby offers to sell to the
            Purchaser, and the Purchaser hereby accepts to purchase the Property for the Purchase Price as
            mentioned in Particulars Item No. VI, payable in the Applicable Currency, in accordance with the
            Payment Schedule mentioned in Particulars Item No. VII.
          </Clause>
        </Section>

        <Section number="2" title="Disclosure Statement">
          <Clause>
            The Property comprises the Unit and the associated Parking, as more particularly described in
            Item III of the Particulars. The size and layout of the Property may be adjusted by the Seller in
            accordance with the terms of this Agreement and the Applicable Laws, subject to the requirements
            of the Relevant Authorities. The Property is designated solely for the Permitted Use specified in
            this Agreement. The Property and the Building shall be constructed in compliance with all
            Applicable Laws.
          </Clause>
          <Clause>
            The Project is situated on the Land located at Plot No. {project.plotNumber || "—"},{" "}
            {project.location}. The Project is a {project.description || "Residential Building"}
            {project.buildingStructure ? ` (${project.buildingStructure})` : ""}; the building name is{" "}
            <strong>{project.name}</strong>. The Project is in the construction stage and is subject to being
            amended, supplemented or varied from time to time in accordance with the Agreement and the
            Applicable Laws. The registered developer of the Project with RERA is{" "}
            <strong>{project.name.toUpperCase()}</strong>
            {project.developerNumber ? ` under developer number ${project.developerNumber}` : ""}.
            {project.buildingPermitRef
              ? ` The Project has obtained Building permit Ref. ${project.buildingPermitRef}.`
              : ""}
          </Clause>
        </Section>

        <Section number="3" title="Purchase Price">
          <Clause>
            The total purchase price for the Property shall be the amount specified in Item VI of the
            Particulars section of this Agreement.
          </Clause>
          <Clause>
            The Purchase Price does not include title deed issuance charges, DLD Registration Fees, Service
            Charges, Master Community Charges, visa applications and any and all other charges and expenses of
            any nature whatsoever in connection with the purchase of the Unit by the Purchaser, and the
            Purchaser shall be responsible for the prompt payment of such amounts.
          </Clause>
          <Clause>
            The Parties agree that all instalments of the Purchase Price shall be paid by the Purchaser into
            the Escrow Account or any other account as may be designated by the Seller, by way of bank
            transfer, cheque, or any other method of payment as approved by the Seller.
          </Clause>
          <Clause>
            Without prejudice to the Seller&rsquo;s other rights under this Agreement, in the event of
            non-payment of any portion of the Purchase Price, Service Charges, or Master Community Charges on
            their respective due dates, the Purchaser shall be liable to pay a delay penalty at a rate of{" "}
            {rules.lateFeeMonthlyPercent}% per month of the overdue amount of the relevant instalment or
            charge, calculated daily and compounded monthly until full settlement is made.
          </Clause>
          <Clause>
            Without prejudice to any other rights of the Seller under this Agreement, the Purchaser shall pay
            a fee of {fmtAED(rules.resaleProcessingFee)} for the processing of resale or mortgage
            transactions, or for the review or approval of any requests or documents submitted by the
            Purchaser. Such fee shall be non-refundable.
          </Clause>
        </Section>

        <Section number="4" title="Seller's Obligations">
          <Clause>
            The Seller shall use reasonable endeavours to procure that the construction of the Project is in
            compliance, in all material respects, with all applicable building codes, regulations and laws in
            force in the Emirate of Dubai, UAE.
          </Clause>
          <Clause>
            The Seller shall remain liable for a period of one (1) year from the Handover Date to repair or
            replace any materially defective civil, structural, mechanical and/or electrical works of the
            Seller in the Property. The Seller shall not be responsible for any normal wear and tear, or
            damage caused by the negligence, act or omission of the Purchaser, tenants, visitors, users and/or
            occupants.
          </Clause>
          <Clause>
            Upon payment of the entire Purchase Price by the Purchaser, the Seller shall transfer title of the
            Property free from any liens, charges, encumbrances, or third-party claims, except as expressly
            agreed in this Agreement.
          </Clause>
          <Clause>
            The Seller shall register this Agreement on the Oqood Interim Property Register after receiving
            20% of the Purchase Price, the DLD Registration Fees, and the administration fee, provided that
            the Purchaser has fulfilled its obligations and signed all required documents.
          </Clause>
        </Section>

        <Section number="5" title="Seller's Variations">
          <Clause>
            The Purchaser acknowledges that the Total Unit Area is approximate and based on architectural
            drawings. If the Actual Area is greater or less than the Total Unit Area by more than five percent
            (5%), the Purchase Price shall be adjusted to equal the amount calculated by multiplying the
            actual area by the agreed Price per Square Meter, without the Purchaser being entitled to
            terminate this Agreement or claim any compensation.
          </Clause>
          <Clause>
            The Seller may modify or replace any of the materials, finishes, fixtures, connections, or
            specifications of the Unit or the Building with similar or equivalent alternatives, as determined
            by the Seller. The Purchaser agrees not to object, make any requisition, or claim compensation for
            such variations.
          </Clause>
        </Section>

        <Section number="6" title="Purchaser's Obligations">
          <Clause>
            The Purchaser is liable for, and has a continuing obligation to pay, the Master Community Charges
            from the Completion Date.
          </Clause>
          <Clause>
            The Purchaser undertakes that the Purchase Price and any other amounts payable pursuant to this
            Agreement are derived from legitimate sources and are not related to proceeds of crime or money
            laundering either directly or indirectly.
          </Clause>
          <Clause>
            Possession and occupation of the Unit shall be deemed to have been delivered to the Purchaser on
            the Handover Date once the Seller issues the Handover Notice, regardless of whether the Purchaser
            physically takes possession. If the Purchaser fails to take possession of the Unit within thirty
            (30) days from the Handover Notice, the Seller may impose reasonable storage, insurance, or
            administrative fees without prejudice to its other rights.
          </Clause>
          {purchasers.length > 1 && (
            <Clause>
              The Purchasers comprise more than one person (&ldquo;Joint Purchasers&rdquo;); all such persons
              shall be jointly and severally liable for the fulfilment of all obligations and payment of any
              amounts due under this Agreement, irrespective of any arrangements or terms agreed between them.
            </Clause>
          )}
        </Section>

        <Section number="7" title="Completion and Handover of Property">
          <Clause>
            The Anticipated Completion Date is{" "}
            <strong>{fmtDate(deal.anticipatedCompletionDate)}</strong> and represents the date upon which it
            is presently expected that the Completion Date of the Property shall occur.
          </Clause>
          <Clause>
            The Seller reserves the right to automatically extend the Anticipated Completion Date by a period
            of up to {rules.gracePeriodMonths} months without the requirement to provide notice and without
            being liable to pay any compensation whatsoever for such an extension.
          </Clause>
          <Clause>
            The Seller shall give the Purchaser a minimum thirty (30) days&rsquo; notice in writing of the
            Completion Date.
          </Clause>
        </Section>

        <Section number="8" title="Inspection and Defect Rectification">
          <Clause>
            The Purchaser (or their authorized nominee) shall be entitled to conduct one inspection of the
            Property after fulfilling all obligations under this Agreement and receiving the Handover Notice,
            but prior to the actual Handover Date. The purpose is to identify any defects or deficiencies in
            the Property.
          </Clause>
          <Clause>
            Upon receipt of the deficiency report, the Seller shall exercise reasonable efforts to rectify the
            confirmed deficiencies within twenty-one (21) days, or within any additional reasonable period if
            required due to the nature of the works.
          </Clause>
        </Section>

        <Section number="9" title="Registration and Transfer of Title">
          <Clause>
            As soon as practicable after the Effective Date, the Seller shall lodge this Agreement for
            Registration within the Interim Property Register at the sole cost of the Purchaser.
          </Clause>
          <Clause>
            Provided that the Purchaser has fully settled the Purchase Price and all other dues payable under
            this Agreement, the Seller shall transfer clear and unencumbered title of the Property to the
            Purchaser at the Land Department as soon as reasonably practicable after the Handover Date.
          </Clause>
        </Section>

        <Section number="10" title="Default and Termination">
          <Clause>
            <strong>Seller&rsquo;s Delay.</strong> If the Seller fails to issue the Completion Notice within a
            stipulated timeframe, and the Purchaser has fully complied with all its obligations, the Purchaser
            may serve a written notice requiring completion of the Property Works within one hundred twenty
            (120) Working Days from the date of receipt of such notice (the &ldquo;Seller&rsquo;s Rectification
            Period&rdquo;).
          </Clause>
          <Clause>
            <strong>Purchaser&rsquo;s Default.</strong> Subject to Applicable Laws and the requirements of the
            Dubai Land Department, the Seller shall have the right to terminate this Agreement without
            reference to any court or judicial order, by issuing a written notice to the Purchaser granting a
            period of thirty (30) days to remedy the breach. If the Purchaser does not remedy the breach
            within such period, the Seller shall be entitled to:
          </Clause>
          <ol className="list-roman list-inside text-sm space-y-2 ml-4">
            <li>terminate this Agreement and resell the Property to any third party;</li>
            <li>
              require the Purchaser to hand over vacant possession of the Property and restore it to the same
              condition in which it was delivered;
            </li>
            <li>
              require the Purchaser to pay an amount equivalent to{" "}
              <strong>{rules.liquidatedDamagesPercent}% of the Purchase Price</strong>, or such other higher or
              lower percentage as may be approved or permitted by the Dubai Land Department, as pre-agreed
              liquidated damages;
            </li>
            <li>
              compensate the Seller for any losses arising from the resale of the Property, together with all
              legal fees and other expenses incurred by the Seller;
            </li>
            <li>
              retain all amounts previously paid by the Purchaser toward the Purchase Price up to the date of
              termination, to the extent necessary to satisfy the Seller&rsquo;s claim for damages.
            </li>
          </ol>
        </Section>

        <Section number="11" title="Assignment and Restrictions on Disposal Prior to Title Transfer">
          <Clause>
            The Purchaser shall not, whether directly or indirectly, advertise, transfer, assign, sell, or
            otherwise dispose of the Property or any part thereof unless and until:
          </Clause>
          <ol className="list-decimal list-inside text-sm space-y-1 ml-4">
            <li>
              the Purchaser has paid at least {rules.disposalThresholdPercent}% of the Purchase Price;
            </li>
            <li>
              the Purchaser and the proposed transferee have executed a novation or assignment agreement in
              the form required by the Seller; and
            </li>
            <li>the Purchaser has obtained the Seller&rsquo;s prior written consent.</li>
          </ol>
          <Clause>
            Any attempted disposal in breach of this Clause shall be null and void.
          </Clause>
        </Section>

        <Section number="12" title="Notices">
          <Clause>
            Any notice given under this Agreement shall be in writing, signed by the notifying Party (or its
            duly authorized representative), and shall be served by delivering it personally, by courier to
            the address set out in this Agreement, or by email to the email address of the Parties.
          </Clause>
        </Section>

        <Section number="13" title="Force Majeure Events">
          <Clause>
            For the purposes of this Agreement, a &ldquo;Force Majeure Event&rdquo; means and includes,
            without limitation, acts of God, pandemic, epidemic, war (whether declared or not), revolution,
            invasion, insurrection, riots, terrorist acts, sabotage or other civil disorders, strikes or other
            labour disputes, failure of infrastructure or fundamental access to the Project, fire, earthquake,
            storm, flood or other natural disaster, environmental impact affecting the Project, interruption
            or failure of utility services of any kind, non-delivery or delayed delivery by contractors, acts
            or omissions of governmental authorities, changes in laws or regulations, or any other
            circumstances beyond the reasonable control of the Seller.
          </Clause>
          <Clause>
            If a Force Majeure Event occurs and affects the progress of the Works, the Anticipated Completion
            Date, Completion Date, and/or Handover Date shall be extended for a period equal to the duration
            of the Force Majeure Event.
          </Clause>
        </Section>

        <Section number="14" title="Delay Compensation">
          <Clause>
            Without prejudice to Force Majeure provisions, if the Seller delays the completion and handover of
            the Unit beyond the Anticipated Completion Date by more than {rules.gracePeriodMonths} months for
            reasons not constituting Force Majeure or Delay Events and not attributable to the Purchaser, the
            Purchaser shall be entitled to compensation at the rate of{" "}
            {rules.delayCompensationAnnualPercent}% per annum of the Purchase Price paid by the Purchaser,
            capped at a maximum of {rules.delayCompensationCapPercent}% of the total Purchase Price of the
            Unit.
          </Clause>
          <Clause>
            The compensation provided under this Clause constitutes the Purchaser&rsquo;s sole and exclusive
            remedy for delay in completion and handover.
          </Clause>
        </Section>

        <Section number="15" title="General Provisions">
          <Clause>
            This Agreement (including the Schedules) and any other documents referred to in this Agreement
            comprise the entire Agreement and understanding among the Parties with respect to the subject
            matter hereof, and supersede all prior agreements, understandings, inducements and conditions.
          </Clause>
          <Clause>
            Any variation of this Agreement shall be effective only if made in writing and signed by both
            Parties.
          </Clause>
          <Clause>
            If any provision is deemed illegal, invalid, or unenforceable under Applicable Laws, the remaining
            provisions shall remain unaffected.
          </Clause>
        </Section>

        <Section number="16" title="Indemnity">
          <Clause>
            The Purchaser shall fully indemnify, defend, and hold harmless the Seller and/or the Master
            Developer from and against any and all actions, claims, proceedings, liabilities, losses, damages,
            costs, and expenses (including legal fees) arising out of or in connection with the
            Purchaser&rsquo;s acts, omissions, or breach of this Agreement.
          </Clause>
        </Section>

        <Section number="17" title="No Disclosure">
          <Clause>
            Each Party shall maintain the confidentiality of the terms and conditions of this Agreement and
            shall not disclose such information to any third party, save to professional advisors, regulators,
            and authorized representatives bound by the same confidentiality obligations.
          </Clause>
        </Section>

        <Section number="18" title="Governing Law">
          <Clause>
            This Agreement shall be governed by and construed in accordance with the Applicable Laws, with the
            exclusive jurisdiction of the Courts of the Emirate of Dubai.
          </Clause>
        </Section>

        <Section number="19" title="Money Laundering and Sanctions">
          <Clause>
            The Purchaser represents that all funds used to pay the Purchase Price or any other amounts under
            this Agreement are derived from legitimate sources and are not related to any illegal activity or
            from any Sanctioned Person or Sanctioned Country.
          </Clause>
          {purchasers.some((p) => p.sourceOfFunds) && (
            <table className="w-full border border-slate-300 text-sm mt-2">
              <thead>
                <tr className="bg-slate-50">
                  <th className="py-2 px-3 text-left font-semibold">Purchaser</th>
                  <th className="py-2 px-3 text-left font-semibold">Source of Funds</th>
                </tr>
              </thead>
              <tbody>
                {purchasers.map((p, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="py-2 px-3">{p.name}</td>
                    <td className="py-2 px-3">{p.sourceOfFunds || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section number="20" title="Language">
          <Clause>
            The language of this Agreement is English. All documents, notices, waivers, variations and other
            written communications relating to this Agreement shall be in English. If this Agreement is
            translated to any other language, the English text shall prevail.
          </Clause>
        </Section>

        {/* Signature block */}
        <section className="mt-16 break-inside-avoid">
          <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-6 border-b border-slate-300 pb-1">
            In Witness Whereof
          </h2>
          <p className="text-sm mb-12">
            This Agreement was signed by or on behalf of the Parties on the Effective Date.
          </p>
          <div className="grid grid-cols-2 gap-12">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Purchaser</p>
              <p className="text-sm font-semibold mb-12">{primary?.name ?? "—"}</p>
              <div className="border-b border-slate-400 h-12 mb-2" />
              <p className="text-xs text-slate-500">Signed by Mr./Ms./Mrs ____________________</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Seller</p>
              <p className="text-sm font-semibold mb-12">{project.name.toUpperCase()}</p>
              <div className="border-b border-slate-400 h-12 mb-2" />
              <p className="text-xs text-slate-500">Signed by Mr./Ms./Mrs ____________________</p>
              <p className="text-xs text-slate-400 mt-3">Company Stamp:</p>
            </div>
          </div>
        </section>

        {/* SCHEDULES */}
        <div className="break-before-page mt-16">
          <h1 className="text-2xl font-bold text-center mb-8">Schedule 1 — Draft Property / Unit Plan</h1>
          {schedules.dimensionedPlanUrl ? (
            <div className="mb-8">
              <p className="text-sm font-semibold mb-2">Dimensioned Plan</p>
              <img
                src={schedules.dimensionedPlanUrl}
                alt="Dimensioned plan"
                className="w-full border border-slate-300"
              />
            </div>
          ) : (
            <p className="text-sm italic text-slate-500 my-8 text-center">
              [ Dimensioned plan to be attached ]
            </p>
          )}
          {schedules.furnishedPlanUrl ? (
            <div className="mb-8">
              <p className="text-sm font-semibold mb-2">Furnished Plan</p>
              <img
                src={schedules.furnishedPlanUrl}
                alt="Furnished plan"
                className="w-full border border-slate-300"
              />
            </div>
          ) : (
            <p className="text-sm italic text-slate-500 my-8 text-center">
              [ Furnished plan to be attached ]
            </p>
          )}
        </div>

        <div className="break-before-page mt-16">
          <h1 className="text-2xl font-bold text-center mb-8">Schedule 2 — Draft Property Specification</h1>
          {specifications.length > 0 ? (
            <table className="w-full border border-slate-300 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-2 px-3 text-left font-semibold border-b border-slate-300">Area</th>
                  <th className="py-2 px-3 text-left font-semibold border-b border-slate-300">Floor Finish</th>
                  <th className="py-2 px-3 text-left font-semibold border-b border-slate-300">Wall Finish</th>
                  <th className="py-2 px-3 text-left font-semibold border-b border-slate-300">Ceiling Finish</th>
                  <th className="py-2 px-3 text-left font-semibold border-b border-slate-300">
                    Additional Finishes
                  </th>
                </tr>
              </thead>
              <tbody>
                {specifications.map((s, i) => (
                  <tr key={i} className="border-t border-slate-200 align-top">
                    <td className="py-2 px-3 font-medium">{SPEC_AREA_LABELS[s.area] || s.area}</td>
                    <td className="py-2 px-3">{s.floorFinish || "—"}</td>
                    <td className="py-2 px-3">{s.wallFinish || "—"}</td>
                    <td className="py-2 px-3">{s.ceilingFinish || "—"}</td>
                    <td className="py-2 px-3">{s.additionalFinishes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm italic text-slate-500 my-8 text-center">
              [ Specifications to be configured for this project ]
            </p>
          )}
        </div>

        <div className="break-before-page mt-16">
          <h1 className="text-2xl font-bold text-center mb-8">Schedule 3 — Draft Floor Plan</h1>
          {schedules.floorPlanUrl ? (
            <img src={schedules.floorPlanUrl} alt="Floor plan" className="w-full border border-slate-300" />
          ) : (
            <p className="text-sm italic text-slate-500 my-8 text-center">
              [ Floor plan to be attached ]
            </p>
          )}
        </div>

        {/* Disclaimer */}
        <div className="break-before-page mt-16">
          <h2 className="text-lg font-bold text-center mb-4">Disclaimer</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            All measurements, dimensions, coordinates and drawings given in the Property (site/floor) Plans
            are approximate and provided only for the purpose of illustration, information and general
            guidance — such drawings are not to scale. All floor/site plans, including concerned
            plot/room/swimming pool sizes, specifications, locations and orientations shown have been taken
            from concept designs prior to actual development/construction and therefore their accuracy in
            relation to actual construction cannot be confirmed. Hence, we make no guarantee, warranty or
            representation as to the accuracy and completeness of the Property (floor/site) plan information
            as changes may be made during the development process without notice. Always refer to the latest
            IFC design available in the sales office for the most accurate representation of all construction
            details.
          </p>
        </div>

        <p className="text-xs text-slate-400 mt-16 text-center border-t border-slate-100 pt-6 print:hidden">
          DRAFT for review · Generated {fmtDate(snap.generatedAt)} · Ref: {deal.dealNumber}
        </p>
      </div>

      <style>{`
        @media print {
          @page { margin: 18mm; size: A4; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:max-w-none { max-width: none !important; }
          .break-after-page { break-after: page; }
          .break-before-page { break-before: page; }
          .break-inside-avoid { break-inside: avoid; }
        }
        ol.list-roman {
          list-style-type: lower-roman;
        }
      `}</style>
    </div>
  );
}
