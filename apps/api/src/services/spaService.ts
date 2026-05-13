import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// SPA snapshot builder
//
// Produces the JSON blob persisted to Document.dataSnapshot when an SPA is
// generated. Mirrors the shape the legal SPA renderer (web) expects so that
// historical regenerations stay byte-stable even if the underlying records
// later change.
// ---------------------------------------------------------------------------

export interface SpaSnapshot {
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
    nameAr: string | null;
    location: string;
    locationAr: string | null;
    description: string | null;
    handoverDate: string;
    commercialLicense: string | null;
    developerNumber: string | null;
    developerAddress: string | null;
    developerAddressAr: string | null;
    developerNameAr: string | null;
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
    id: string;
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
    // Arabic legal name composed from Lead.firstNameAr + Lead.lastNameAr.
    // Null when either part is missing — the bilingual template falls back
    // to "—" and the preview route reports it in `missingArabic`.
    nameAr: string | null;
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
    escrow: BankAccountSnapshot | null;
    current: BankAccountSnapshot | null;
    escrowReference: string | null; // e.g. "SR2-STD-207"
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

interface BankAccountSnapshot {
  accountName: string;
  bankName: string;
  branchAddress: string | null;
  iban: string;
  accountNumber: string;
  refPrefix: string | null;
}

// SPA payment-schedule labels read more naturally as human phrases than
// computed dates ("Within 30 days of reservation", "March 2026"). We derive
// a label from the milestone trigger; render-side can override.
function anticipatedDateLabel(opts: {
  dueDate: Date;
  scheduleTrigger: string | null | undefined;
}): string {
  const { dueDate, scheduleTrigger } = opts;
  switch (scheduleTrigger) {
    case "ON_SPA_SIGNING":
      return "On SPA signing";
    case "ON_OQOOD":
      return "On Oqood registration";
    case "ON_HANDOVER":
      return "On handover";
    case "DAYS_FROM_RESERVATION":
      return "Within 30 days of reservation";
    default:
      return dueDate.toLocaleDateString("en-AE", { month: "long", year: "numeric" });
  }
}

export async function buildSpaSnapshot(dealId: string): Promise<SpaSnapshot> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      lead: true,
      unit: {
        include: {
          project: {
            include: {
              config: true,
              bankAccounts: true,
              specifications: { orderBy: { sortOrder: "asc" } },
            },
          },
          images: { orderBy: { sortOrder: "asc" } },
        },
      },
      paymentPlan: true,
      payments: { orderBy: { dueDate: "asc" } },
      purchasers: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const project = deal.unit.project;
  const config = project.config;
  const escrow = project.bankAccounts.find((a) => a.purpose === "ESCROW") ?? null;
  const current = project.bankAccounts.find((a) => a.purpose === "CURRENT") ?? null;

  // Purchaser list: prefer DealPurchaser rows. Fall back to deal.lead so the
  // SPA always renders something even before joint-purchaser data is captured.
  // Compose the Arabic full name only when both parts are present — a partial
  // Arabic name renders worse than no name at all in legal documents.
  const leadNameAr =
    deal.lead.firstNameAr && deal.lead.lastNameAr
      ? `${deal.lead.firstNameAr} ${deal.lead.lastNameAr}`
      : null;

  const purchasers = deal.purchasers.length
    ? deal.purchasers.map((p) => ({
        name: p.name,
        // DealPurchaser doesn't carry an Arabic name yet; surface the lead's
        // Arabic name on the primary purchaser as the best-effort fallback.
        nameAr: p.isPrimary ? leadNameAr : null,
        ownershipPercentage: p.ownershipPercentage,
        address: p.address,
        phone: p.phone,
        email: p.email,
        nationality: p.nationality,
        emiratesId: p.emiratesId,
        passportNumber: p.passportNumber,
        companyRegistrationNumber: p.companyRegistrationNumber,
        authorizedSignatory: p.authorizedSignatory,
        sourceOfFunds: p.sourceOfFunds,
        isPrimary: p.isPrimary,
      }))
    : [
        {
          name: `${deal.lead.firstName} ${deal.lead.lastName}`,
          nameAr: leadNameAr,
          ownershipPercentage: 100,
          address: deal.lead.address,
          phone: deal.lead.phone,
          email: deal.lead.email,
          nationality: deal.lead.nationality,
          emiratesId: deal.lead.emiratesId,
          passportNumber: deal.lead.passportNumber,
          companyRegistrationNumber: deal.lead.companyRegistrationNumber,
          authorizedSignatory: deal.lead.authorizedSignatory,
          sourceOfFunds: deal.lead.sourceOfFunds,
          isPrimary: true,
        },
      ];

  // Anticipated completion date cascades: deal → unit → project handover.
  const anticipatedCompletion =
    deal.anticipatedCompletionDate ??
    deal.unit.anticipatedCompletionDate ??
    project.handoverDate;

  // Per-unit escrow reference, e.g. "SR2-STD-207".
  const escrowReference = escrow?.refPrefix
    ? `${escrow.refPrefix}${deal.unit.unitNumber}`
    : null;

  // Schedule attachments — picked from UnitImage by image type.
  const findImage = (type: string) =>
    deal.unit.images.find((i) => i.type === type)?.url ?? null;

  return {
    generatedAt: new Date().toISOString(),
    deal: {
      id: deal.id,
      dealNumber: deal.dealNumber,
      salePrice: deal.salePrice,
      discount: deal.discount,
      netSalePrice: deal.salePrice - deal.discount,
      reservationAmount: deal.reservationAmount,
      dldFee: deal.dldFee,
      adminFee: deal.adminFee,
      reservationDate: deal.reservationDate.toISOString(),
      oqoodDeadline: deal.oqoodDeadline.toISOString(),
      anticipatedCompletionDate: anticipatedCompletion.toISOString(),
    },
    project: {
      id: project.id,
      name: project.name,
      nameAr: project.nameAr,
      location: project.location,
      locationAr: project.locationAr,
      description: project.description,
      handoverDate: project.handoverDate.toISOString(),
      commercialLicense: project.commercialLicense,
      developerNumber: project.developerNumber,
      developerAddress: project.developerAddress,
      developerAddressAr: project.developerAddressAr,
      developerNameAr: project.developerNameAr,
      developerPhone: project.developerPhone,
      developerEmail: project.developerEmail,
      plotNumber: project.plotNumber,
      buildingPermitRef: project.buildingPermitRef,
      buildingStructure: project.buildingStructure,
      masterDeveloper: project.masterDeveloper,
      masterCommunity: project.masterCommunity,
      permittedUse: project.permittedUse,
    },
    unit: {
      id: deal.unit.id,
      unitNumber: deal.unit.unitNumber,
      floor: deal.unit.floor,
      type: deal.unit.type,
      view: deal.unit.view,
      area: deal.unit.area,
      areaSqft: deal.unit.areaSqft,
      ratePerSqft: deal.unit.ratePerSqft,
      smartHome: deal.unit.smartHome,
      bathrooms: deal.unit.bathrooms,
      parkingSpaces: deal.unit.parkingSpaces,
      internalArea: deal.unit.internalArea,
      externalArea: deal.unit.externalArea,
    },
    purchasers,
    payments: deal.payments.map((p) => ({
      label: p.milestoneLabel,
      percentage: p.percentage,
      amount: p.amount,
      dueDate: p.dueDate.toISOString(),
      anticipatedDateLabel: anticipatedDateLabel({
        dueDate: p.dueDate,
        scheduleTrigger: p.scheduleTrigger,
      }),
      targetAccount: p.targetAccount,
      paymentReference: p.paymentReference,
    })),
    bankAccounts: {
      escrow: escrow
        ? {
            accountName: escrow.accountName,
            bankName: escrow.bankName,
            branchAddress: escrow.branchAddress,
            iban: escrow.iban,
            accountNumber: escrow.accountNumber,
            refPrefix: escrow.refPrefix,
          }
        : null,
      current: current
        ? {
            accountName: current.accountName,
            bankName: current.bankName,
            branchAddress: current.branchAddress,
            iban: current.iban,
            accountNumber: current.accountNumber,
            refPrefix: current.refPrefix,
          }
        : null,
      escrowReference,
    },
    specifications: project.specifications.map((s) => ({
      area: s.area,
      floorFinish: s.floorFinish,
      wallFinish: s.wallFinish,
      ceilingFinish: s.ceilingFinish,
      additionalFinishes: s.additionalFinishes,
    })),
    schedules: {
      dimensionedPlanUrl: findImage("SCHEDULE_DIMENSIONED"),
      furnishedPlanUrl: findImage("SCHEDULE_FURNISHED"),
      floorPlanUrl: findImage("SCHEDULE_FLOOR_PLAN"),
    },
    rules: {
      lateFeeMonthlyPercent: config?.lateFeeMonthlyPercent ?? 2,
      delayCompensationAnnualPercent: config?.delayCompensationAnnualPercent ?? 1,
      delayCompensationCapPercent: config?.delayCompensationCapPercent ?? 5,
      liquidatedDamagesPercent: config?.liquidatedDamagesPercent ?? 40,
      disposalThresholdPercent: config?.disposalThresholdPercent ?? 30,
      resaleProcessingFee: config?.resaleProcessingFee ?? 3000,
      gracePeriodMonths: config?.gracePeriodMonths ?? 12,
    },
  };
}
