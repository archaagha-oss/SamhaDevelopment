import { z } from "zod";

// ===== PROJECTS =====
const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

// ----- Optional SPA-particulars fields used on Project create/update.
// All optional/nullable so existing forms keep working unchanged.
const projectSpaParticulars = {
  commercialLicense: z.string().optional().nullable(),
  developerNumber: z.string().optional().nullable(),
  developerAddress: z.string().optional().nullable(),
  developerPhone: z.string().optional().nullable(),
  developerEmail: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  plotNumber: z.string().optional().nullable(),
  buildingPermitRef: z.string().optional().nullable(),
  buildingStructure: z.string().optional().nullable(),
  masterDeveloper: z.string().optional().nullable(),
  masterCommunity: z.string().optional().nullable(),
  permittedUse: z.string().optional().nullable(),
};

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  location: z.string().min(1, "Location is required"),
  description: z.string().optional(),
  totalUnits: z.number().int().positive("Total units must be positive"),
  totalFloors: z.number().int().positive().optional(),
  projectStatus: z.enum(PROJECT_STATUSES).optional(),
  handoverDate: z.string().min(1, "Handover date is required"),
  launchDate: z.string().optional(),
  startDate: z.string().optional(),
  ...projectSpaParticulars,
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  description: z.string().optional(),
  totalUnits: z.number().int().positive().optional(),
  totalFloors: z.number().int().positive().optional(),
  projectStatus: z.enum(PROJECT_STATUSES).optional(),
  handoverDate: z.string().optional(),
  launchDate: z.string().optional(),
  startDate: z.string().optional(),
  ...projectSpaParticulars,
});

// ===== UNITS =====
export const updateUnitStatusSchema = z.object({
  newStatus: z.enum([
    "NOT_RELEASED",
    "AVAILABLE",
    "RESERVED",
    "BOOKED",
    "SOLD",
    "BLOCKED",
    "HANDED_OVER",
  ]),
  reason: z.string().optional(),
});

// ===== LEADS =====
// SPA / KYC fields applied to both create and update — all optional.
const leadKycFields = {
  address: z.string().optional().nullable(),
  emiratesId: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  companyRegistrationNumber: z.string().optional().nullable(),
  authorizedSignatory: z.string().optional().nullable(),
  sourceOfFunds: z.string().optional().nullable(),
};

export const createLeadSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/, "Invalid phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  nationality: z.string().optional(),
  source: z.enum(["DIRECT", "BROKER", "WEBSITE", "REFERRAL"]),
  budget: z.number().positive("Budget must be positive").optional().or(z.literal(null)),
  assignedAgentId: z.string().min(1, "Assigned agent is required"),
  brokerCompanyId: z.string().optional(),
  brokerAgentId: z.string().optional(),
  notes: z.string().optional(),
  ...leadKycFields,
});

export const updateLeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/, "Invalid phone number").optional(),
  email: z.string().email("Invalid email").optional(),
  nationality: z.string().optional(),
  source: z.enum(["DIRECT", "BROKER", "WEBSITE", "REFERRAL"]).optional(),
  budget: z.number().positive().optional(),
  stage: z
    .enum([
      "NEW",
      "CONTACTED",
      "QUALIFIED",
      "VIEWING",
      "PROPOSAL",
      "NEGOTIATING",
      "CLOSED_WON",
      "CLOSED_LOST",
    ])
    .optional(),
  assignedAgentId: z.string().optional(),
  ...leadKycFields,
});

export const logActivitySchema = z.object({
  type: z.enum(["CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "NOTE"]),
  summary: z.string().min(1, "Activity summary is required"),
  outcome: z.string().optional(),
  callDuration: z.number().int().optional(),
  followUpDate: z.string().optional(),
});

// ===== DEALS =====
export const createDealSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  unitId: z.string().min(1, "Unit ID is required"),
  salePrice: z.number().positive("Sale price must be positive"),
  discount: z.number().nonnegative("Discount cannot be negative").default(0),
  reservationAmount: z.number().nonnegative("Reservation amount cannot be negative").default(0),
  paymentPlanId: z.string().min(1, "Payment plan is required"),
  brokerCompanyId: z.string().optional(),
  brokerAgentId: z.string().optional(),
});

export const updateDealStageSchema = z.object({
  newStage: z.enum([
    "RESERVATION_PENDING",
    "RESERVATION_CONFIRMED",
    "SPA_PENDING",
    "SPA_SENT",
    "SPA_SIGNED",
    "OQOOD_PENDING",
    "OQOOD_REGISTERED",
    "INSTALLMENTS_ACTIVE",
    "HANDOVER_PENDING",
    "COMPLETED",
    "CANCELLED",
  ]),
});

// ===== PAYMENTS =====
export const markPaymentPaidSchema = z.object({
  paidDate: z.string().datetime("Invalid date format"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "PDC", "CREDIT_CARD"]),
  paidBy: z.string().min(1, "Paid by is required"),
});

// One row of a bulk payment-import CSV. Either dealNumber+milestoneLabel or
// paymentId must be provided; paymentId wins when both are supplied.
// paidDate accepts ISO datetime (e.g. "2025-09-12T00:00:00Z") OR YYYY-MM-DD
// (e.g. "2025-09-12"). Validation here is intentionally lenient — the
// service layer normalizes dates.
export const bulkPaymentRowSchema = z
  .object({
    paymentId: z.string().trim().min(1).optional(),
    dealNumber: z.string().trim().min(1).optional(),
    milestoneLabel: z.string().trim().min(1).optional(),
    amount: z.number().positive("Amount must be positive"),
    paidDate: z
      .string()
      .min(1, "paidDate is required")
      .refine(
        (v) => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v.trim()),
        "paidDate must be ISO datetime or YYYY-MM-DD"
      ),
    paymentMethod: z.string().trim().min(1, "paymentMethod is required"),
    receiptKey: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .refine(
    (v) => Boolean(v.paymentId) || (Boolean(v.dealNumber) && Boolean(v.milestoneLabel)),
    {
      message: "Either paymentId, or both dealNumber and milestoneLabel, must be provided",
      path: ["paymentId"],
    }
  );

export type BulkPaymentRowInput = z.infer<typeof bulkPaymentRowSchema>;

// ===== BROKERS =====
export const createBrokerCompanySchema = z.object({
  name: z.string().min(1, "Broker name is required"),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/, "Invalid phone number").optional(),
  reraLicenseNumber: z.string().optional(),
  reraLicenseExpiry: z.string().datetime().optional(),
  tradeLicenseNumber: z.string().optional(),
  tradeLicenseCopyUrl: z.string().optional(),
  vatCertificateNo: z.string().optional(),
  vatCertificateUrl: z.string().optional(),
  corporateTaxCertUrl: z.string().optional(),
  officeRegistrationNo: z.string().optional(),
  ornCertificateUrl: z.string().optional(),
  officeManagerBrokerId: z.string().optional(),
  website: z.string().optional(),
  officeNo: z.string().optional(),
  buildingName: z.string().optional(),
  neighborhood: z.string().optional(),
  emirate: z.string().optional(),
  postalCode: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankIban: z.string().optional(),
  bankCurrency: z.string().optional(),
  commissionRate: z.number().nonnegative().max(100).default(4),
});

export const createBrokerAgentSchema = z.object({
  companyId: z.string().min(1, "Company ID is required"),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/, "Invalid phone number").optional(),
  reraCardNumber: z.string().optional(),
  reraCardExpiry: z.string().datetime().optional(),
  eidNo: z.string().optional(),
  eidExpiry: z.string().datetime().optional(),
  eidFrontUrl: z.string().optional(),
  eidBackUrl: z.string().optional(),
  acceptedConsent: z.boolean().optional(),
});

// ===== BULK OPS =====
const BULK_OPERATIONS = ["RELEASE", "BLOCK", "UNBLOCK", "PRICE_UPDATE", "ASSIGN_AGENT"] as const;

export const bulkOpsSchema = z.object({
  unitIds: z.array(z.string().min(1)).min(1, "At least one unit is required").max(200),
  operation: z.enum(BULK_OPERATIONS),
  value: z.any().optional(),
  reason: z.string().optional(),
});

// ===== UNITS (create/edit) =====
const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_BR", "COMMERCIAL"] as const;
const UNIT_VIEWS = ["SEA", "GARDEN", "STREET", "BACK", "SIDE", "AMENITIES"] as const;

// SPA-particulars unit fields applied to both create and update.
const unitSpaFields = {
  areaSqft: z.number().nonnegative().optional().nullable(),
  ratePerSqft: z.number().nonnegative().optional().nullable(),
  smartHome: z.boolean().optional().nullable(),
  anticipatedCompletionDate: z.string().optional().nullable(),
};

export const createUnitSchema = z.object({
  projectId: z.string().min(1),
  unitNumber: z.string().min(1, "Unit number is required"),
  floor: z.number().int().min(0),
  type: z.enum(UNIT_TYPES),
  area: z.number().positive("Area must be positive"),
  price: z.number().positive("Price must be positive"),
  view: z.enum(UNIT_VIEWS),
  // Physical layer (all optional)
  bathrooms: z.number().int().min(0).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  internalArea: z.number().positive().optional(),
  externalArea: z.number().nonnegative().optional(),
  // Operational layer (all optional)
  internalNotes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ...unitSpaFields,
  // Portal listing (all optional)
  trakheesiPermit: z.string().optional(),
  portalEnabled: z.boolean().optional(),
  portalTitle: z.string().optional(),
  portalDescription: z.string().optional(),
});

export const updateUnitSchema = z.object({
  type: z.enum(UNIT_TYPES).optional(),
  area: z.number().positive().optional(),
  price: z.number().positive().optional(),
  view: z.enum(UNIT_VIEWS).optional(),
  floor: z.number().int().min(0).optional(),
  assignedAgentId: z.string().nullable().optional(),
  // Physical layer (all optional)
  bathrooms: z.number().int().min(0).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  internalArea: z.number().positive().optional(),
  externalArea: z.number().nonnegative().optional(),
  // Operational layer (all optional)
  blockExpiresAt: z.string().datetime().optional(),
  internalNotes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ...unitSpaFields,
  paymentPlan: z.string().nullable().optional(),
  // Portal listing (all optional)
  trakheesiPermit: z.string().nullable().optional(),
  portalEnabled: z.boolean().optional(),
  portalTitle: z.string().nullable().optional(),
  portalDescription: z.string().nullable().optional(),
});

export const bulkCreateUnitsSchema = z.object({
  projectId: z.string().min(1),
  floor: z.number().int().min(0),
  startUnit: z.number().int().min(1),
  count: z.number().int().min(1).max(50),
  type: z.enum(UNIT_TYPES),
  area: z.number().positive(),
  price: z.number().positive(),
  view: z.enum(UNIT_VIEWS),
});

// ===== DOCUMENTS =====
export const uploadDocumentSchema = z.object({
  dealId: z.string().min(1, "Deal ID is required"),
  type: z.enum([
    "RESERVATION_FORM",
    "SPA",
    "OQOOD_CERTIFICATE",
    "PAYMENT_RECEIPT",
    "TITLE_DEED",
    "PASSPORT",
    "EMIRATES_ID",
    "VISA",
    "POA",
    "MORTGAGE_APPROVAL",
    "NOC",
    "HANDOVER_CHECKLIST",
    "OTHER",
  ]).optional(),
  expiryDate: z.string().datetime("Invalid date format").optional(),
});

// ===== PROJECT CONFIG =====
export const updateProjectConfigSchema = z.object({
  dldPercent: z.number().nonnegative().max(100).optional(),
  adminFee: z.number().nonnegative().optional(),
  reservationDays: z.number().int().positive().optional(),
  oqoodDays: z.number().int().positive().optional(),
  vatPercent: z.number().nonnegative().max(100).optional(),
  agencyFeePercent: z.number().nonnegative().max(100).optional(),
  unitsPerFloor: z.number().int().min(1).max(100).optional(),
  totalFloors: z.number().int().min(1).max(200).optional(),
  defaultUnitType: z.string().min(1).optional(),
  defaultArea: z.number().positive().optional(),
  defaultView: z.string().min(1).optional(),
  defaultPrice: z.number().positive().optional(),

  // SPA business-rule constants
  lateFeeMonthlyPercent: z.number().nonnegative().max(100).optional(),
  delayCompensationAnnualPercent: z.number().nonnegative().max(100).optional(),
  delayCompensationCapPercent: z.number().nonnegative().max(100).optional(),
  liquidatedDamagesPercent: z.number().nonnegative().max(100).optional(),
  disposalThresholdPercent: z.number().nonnegative().max(100).optional(),
  resaleProcessingFee: z.number().nonnegative().optional(),
  gracePeriodMonths: z.number().int().nonnegative().max(60).optional(),
});

// ===== PROJECT BANK ACCOUNT =====
export const upsertProjectBankAccountSchema = z.object({
  purpose: z.enum(["ESCROW", "CURRENT"]),
  accountName: z.string().min(1, "Account name is required"),
  bankName: z.string().min(1, "Bank name is required"),
  branchAddress: z.string().optional().nullable(),
  iban: z.string().min(1, "IBAN is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  refPrefix: z.string().optional().nullable(),
});

// ===== PROJECT SPECIFICATION =====
const SPEC_AREAS = [
  "FOYER", "LIVING_AREA", "DINING_AREA", "BEDROOM", "KITCHEN",
  "MASTER_BATHROOM", "SECONDARY_BATHROOM", "BALCONY",
  "POWDER_ROOM", "STUDY", "MAID_ROOM", "LAUNDRY",
] as const;

export const upsertProjectSpecificationsSchema = z.object({
  specifications: z.array(
    z.object({
      area: z.enum(SPEC_AREAS),
      floorFinish: z.string().optional().nullable(),
      wallFinish: z.string().optional().nullable(),
      ceilingFinish: z.string().optional().nullable(),
      additionalFinishes: z.string().optional().nullable(),
      sortOrder: z.number().int().nonnegative().optional(),
    })
  ),
});

// ===== DEAL PURCHASER =====
export const upsertDealPurchaserSchema = z.object({
  id: z.string().optional(), // present when updating an existing row
  leadId: z.string().optional().nullable(),
  name: z.string().min(1, "Purchaser name is required"),
  ownershipPercentage: z.number().nonnegative().max(100),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  nationality: z.string().optional().nullable(),
  emiratesId: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  companyRegistrationNumber: z.string().optional().nullable(),
  authorizedSignatory: z.string().optional().nullable(),
  sourceOfFunds: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const replaceDealPurchasersSchema = z.object({
  purchasers: z.array(upsertDealPurchaserSchema).min(1, "At least one purchaser is required"),
});

// ===== CONTACT =====
export const createContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")).or(z.null()),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/, "Invalid phone number").optional().or(z.literal("")).or(z.null()),
  whatsapp: z.string().optional().or(z.literal("")).or(z.null()),
  company: z.string().optional().or(z.literal("")).or(z.null()),
  jobTitle: z.string().optional().or(z.literal("")).or(z.null()),
  nationality: z.string().optional().or(z.literal("")).or(z.null()),
  source: z.enum(["MANUAL", "LEAD", "BROKER", "REFERRAL", "IMPORT"]).optional(),
  notes: z.string().optional().or(z.literal("")).or(z.null()),
  tags: z.string().optional().or(z.literal("")).or(z.null()),
});

export const updateContactSchema = createContactSchema.partial();

// ===== HANDOVER CHECKLIST =====
export const updateChecklistItemSchema = z
  .object({
    completed: z.boolean().optional(),
    notes:     z.string().optional(),
  })
  .refine(
    (v) => v.completed !== undefined || v.notes !== undefined,
    { message: "At least one of `completed` or `notes` is required" },
  );

export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;

// ===== CONSTRUCTION MILESTONES =====
// Date fields accept either an ISO datetime or a YYYY-MM-DD calendar date;
// the service layer normalizes via `new Date(...)`. completedDate accepts
// `null` explicitly so callers can clear it.
const isoOrDateString = z
  .string()
  .min(1)
  .refine(
    (v) => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v.trim()),
    "Must be ISO datetime or YYYY-MM-DD",
  );

export const updateConstructionMilestoneSchema = z
  .object({
    progressPercent: z.number().int().min(0).max(100).optional(),
    completedDate:   isoOrDateString.nullable().optional(),
    targetDate:      isoOrDateString.optional(),
    notes:           z.string().nullable().optional(),
    label:           z.string().min(1).optional(),
    description:     z.string().nullable().optional(),
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    { message: "At least one field is required" },
  );

export const createConstructionMilestoneSchema = z.object({
  label:           z.string().min(1, "Label is required"),
  targetDate:      isoOrDateString,
  description:     z.string().optional().nullable(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  sortOrder:       z.number().int().nonnegative().optional(),
  notes:           z.string().optional().nullable(),
});

export type UpdateConstructionMilestoneInput = z.infer<typeof updateConstructionMilestoneSchema>;
export type CreateConstructionMilestoneInput = z.infer<typeof createConstructionMilestoneSchema>;

// Type exports for use in route handlers
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LogActivityInput = z.infer<typeof logActivitySchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealStageInput = z.infer<typeof updateDealStageSchema>;
export type MarkPaymentPaidInput = z.infer<typeof markPaymentPaidSchema>;
export type CreateBrokerCompanyInput = z.infer<typeof createBrokerCompanySchema>;
export type CreateBrokerAgentInput = z.infer<typeof createBrokerAgentSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type BulkCreateUnitsInput = z.infer<typeof bulkCreateUnitsSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateProjectConfigInput = z.infer<typeof updateProjectConfigSchema>;
export type UpsertProjectBankAccountInput = z.infer<typeof upsertProjectBankAccountSchema>;
export type UpsertProjectSpecificationsInput = z.infer<typeof upsertProjectSpecificationsSchema>;
export type ReplaceDealPurchasersInput = z.infer<typeof replaceDealPurchasersSchema>;
