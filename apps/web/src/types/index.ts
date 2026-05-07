export type CompletionStatus = "OFF_PLAN" | "UNDER_CONSTRUCTION" | "READY";
export type PropertyPurpose  = "SALE" | "RENT";
export type FurnishingStatus = "UNFURNISHED" | "SEMI_FURNISHED" | "FURNISHED";

export type UnitStatus =
  | "NOT_RELEASED"
  | "AVAILABLE"
  | "ON_HOLD"
  | "RESERVED"
  | "BOOKED"
  | "SOLD"
  | "BLOCKED"
  | "HANDED_OVER";

export type UnitType =
  | "STUDIO"
  | "ONE_BR"
  | "TWO_BR"
  | "THREE_BR"
  | "FOUR_BR"
  | "COMMERCIAL";

export type ViewType = "SEA" | "GARDEN" | "STREET" | "BACK" | "SIDE" | "AMENITIES";

export type UnitImageType = "PHOTO" | "FLOOR_PLAN" | "FLOOR_MAP";

export interface UnitImage {
  id: string;
  unitId: string;
  url: string;
  caption?: string;
  type: UnitImageType;
  sortOrder: number;
  createdAt: string;
}

export type UserRole = "ADMIN" | "SALES_AGENT" | "OPERATIONS" | "FINANCE" | "DEVELOPER";

export interface Project {
  id: string;
  name: string;
  location: string;
  totalUnits: number;
  handoverDate: string;
  projectStatus: string;
  completionStatus: CompletionStatus;
  purpose: PropertyPurpose;
  furnishing: FurnishingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  projectId: string;
  unitNumber: string;
  floor: number;
  type: UnitType;
  area: number;
  basePrice?: number;
  price: number;
  view: ViewType;
  status: UnitStatus;
  // Physical layer
  bathrooms?: number;
  parkingSpaces?: number;
  internalArea?: number;
  externalArea?: number;
  // Operational layer
  blockReason?: string;
  blockExpiresAt?: string;
  holdExpiresAt?: string;
  internalNotes?: string;
  tags?: string[];
  paymentPlan?: string;
  // Media
  images?: UnitImage[];
  // Computed (populated by GET /:id only)
  inquiryCount?: number;
  visitCount?: number;
  pricePerSqft?: number;
  // Project context (populated by GET /:id only)
  project?: Pick<Project, "id" | "name" | "location" | "handoverDate" | "projectStatus" | "completionStatus" | "purpose" | "furnishing">;
  // Commercial context (populated by GET /:id only)
  deals?: UnitDealContext[];
  reservations?: UnitReservationContext[];
  interests?: UnitInterestContext[];
  // Legacy/deprecated
  interestedBuyerId?: string;
  bookedById?: string;
  soldToId?: string;
  reservedById?: string;
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitDealContext {
  id: string;
  dealNumber: string;
  stage: string;
  salePrice: number;
  lead: { id: string; firstName: string; lastName: string; };
}

export interface UnitReservationContext {
  id: string;
  status: string;
  expiresAt: string;
  lead: { id: string; firstName: string; lastName: string; phone?: string; };
}

export interface UnitInterestContext {
  leadId: string;
  isPrimary: boolean;
  addedAt: string;
  lead: { id: string; firstName: string; lastName: string; phone?: string; stage: string; };
}

export interface UnitStatusHistory {
  id: string;
  unitId: string;
  oldStatus: UnitStatus;
  newStatus: UnitStatus;
  changedBy: string;
  reason?: string;
  changedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  department?: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStats {
  total: number;
  byStatus: Record<UnitStatus, number>;
}

export type DocumentType =
  | "RESERVATION_FORM"
  | "SPA"
  | "OQOOD_CERTIFICATE"
  | "PAYMENT_RECEIPT"
  | "TITLE_DEED"
  | "PASSPORT"
  | "EMIRATES_ID"
  | "VISA"
  | "POA"
  | "MORTGAGE_APPROVAL"
  | "NOC"
  | "HANDOVER_CHECKLIST"
  | "OTHER";

export type ActivityType = "CALL" | "EMAIL" | "WHATSAPP" | "MEETING" | "SITE_VISIT" | "NOTE";

export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "OFFER_SENT"
  | "SITE_VISIT"
  | "NEGOTIATING"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export type LeadSource = "DIRECT" | "BROKER" | "WEBSITE" | "REFERRAL";

export interface Document {
  id: string;
  dealId: string;
  name: string;
  type: DocumentType;
  mimeType: string;
  s3Key: string;
  uploadedBy: string;
  expiryDate?: string;
  createdAt: string;
}
