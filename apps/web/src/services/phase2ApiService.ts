/**
 * Phase 2/3 API client — thin axios wrappers grouped by resource.
 * Each function returns the typed response.data so callers don't unwrap.
 */
import axios from "axios";

// ----- KYC -----
export const kycApi = {
  listForLead: (leadId: string) =>
    axios.get(`/api/kyc/lead/${leadId}`).then((r: any) => r.data.data ?? []),
  get: (id: string) => axios.get(`/api/kyc/${id}`).then((r: any) => r.data),
  create: (leadId: string, body: Record<string, unknown>) =>
    axios.post(`/api/kyc/lead/${leadId}`, body).then((r: any) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    axios.patch(`/api/kyc/${id}`, body).then((r: any) => r.data),
  remove: (id: string) => axios.delete(`/api/kyc/${id}`).then((r: any) => r.data),
};

// ----- Deal parties -----
export const dealPartiesApi = {
  list: (dealId: string) =>
    axios.get(`/api/deal-parties/deal/${dealId}`).then((r: any) => r.data.data ?? []),
  replace: (
    dealId: string,
    parties: Array<{
      leadId: string;
      role?: "PRIMARY" | "CO_BUYER" | "GUARANTOR";
      ownershipPercentage: number;
    }>,
  ) =>
    axios
      .put(`/api/deal-parties/deal/${dealId}`, { parties })
      .then((r: any) => r.data.data),
};

// ----- Phases -----
export const phasesApi = {
  listForProject: (projectId: string) =>
    axios.get(`/api/phases/project/${projectId}`).then((r: any) => r.data.data ?? []),
  create: (body: Record<string, unknown>) =>
    axios.post("/api/phases", body).then((r: any) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    axios.patch(`/api/phases/${id}`, body).then((r: any) => r.data),
  changeReleaseStage: (id: string, newStage: string, reason?: string) =>
    axios
      .post(`/api/phases/${id}/release-stage`, { newStage, reason })
      .then((r: any) => r.data),
  remove: (id: string) => axios.delete(`/api/phases/${id}`).then((r: any) => r.data),
};

// ----- Unit type plans -----
export const typePlansApi = {
  listForProject: (projectId: string) =>
    axios.get(`/api/unit-type-plans/project/${projectId}`).then((r: any) => r.data.data ?? []),
  create: (body: Record<string, unknown>) =>
    axios.post("/api/unit-type-plans", body).then((r: any) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    axios.patch(`/api/unit-type-plans/${id}`, body).then((r: any) => r.data),
  remove: (id: string) =>
    axios.delete(`/api/unit-type-plans/${id}`).then((r: any) => r.data),
};

// ----- Construction milestones -----
// Backend mounts at /api/construction (see apps/api/src/routes/construction.ts).
// `GET /:projectId` returns { overallPercent, completedCount, totalCount, milestones }
// where each milestone has { id, projectId, label, description, targetDate,
// completedDate, progressPercent, sortOrder, notes, lastUpdatedBy, createdAt,
// updatedAt }. `listForProject` flattens to the page's legacy field names so
// ConstructionProgressPage continues to compile against its existing
// Milestone interface; `getProgress` exposes the full response for new
// callers that want overall %.
type RawMilestone = {
  id: string;
  projectId: string;
  label: string;
  description: string | null;
  targetDate: string;
  completedDate: string | null;
  progressPercent: number;
  sortOrder: number;
  notes: string | null;
  lastUpdatedBy: string | null;
};

type ProgressResponse = {
  overallPercent: number;
  completedCount: number;
  totalCount: number;
  milestones: RawMilestone[];
};

function mapMilestone(m: RawMilestone) {
  return {
    id:              m.id,
    // Legacy page filtered by `stage` (EXCAVATION/FOUNDATION/...) and grouped
    // sections by it. The new milestone model has no stage — every milestone
    // is reported under the catch-all bucket so the page renders flat.
    stage:           "MILESTONE",
    label:           m.label,
    description:     m.description,
    percentComplete: m.progressPercent,
    expectedDate:    m.targetDate,
    achievedDate:    m.completedDate,
    phaseId:         null as string | null,
  };
}

export const constructionApi = {
  listForProject: (projectId: string) =>
    axios.get(`/api/construction/${projectId}`).then((r: any) => {
      const data = r.data as ProgressResponse;
      return (data.milestones ?? []).map(mapMilestone);
    }),
  getProgress: (projectId: string) =>
    axios.get(`/api/construction/${projectId}`).then((r: any) => r.data as ProgressResponse),
  create: (projectId: string, body: Record<string, unknown>) =>
    axios.post(`/api/construction/${projectId}/milestones`, body).then((r: any) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    axios.patch(`/api/construction/milestones/${id}`, body).then((r: any) => r.data),
  remove: (id: string) =>
    axios.delete(`/api/construction/milestones/${id}`).then((r: any) => r.data),
  // Legacy signature retained for ConstructionProgressPage. Maps the page's
  // `percentComplete` number into the backend's `progressPercent` patch. The
  // backend doesn't return `paymentsTriggered` — page treats it as optional
  // (`(result as any).paymentsTriggered?.length ?? 0`), so the toast just
  // says "Updated to N%" without the payment-fired suffix.
  updatePercent: (id: string, percentComplete: number) =>
    axios
      .patch(`/api/construction/milestones/${id}`, { progressPercent: percentComplete })
      .then((r: any) => r.data),
};

// ----- Snags -----
export const snagsApi = {
  listForUnit: (unitId: string) =>
    axios.get(`/api/snags/unit/${unitId}`).then((r: any) => r.data.data ?? []),
  createList: (unitId: string, label?: string) =>
    axios.post(`/api/snags/unit/${unitId}`, { label }).then((r: any) => r.data),
  addItem: (listId: string, body: Record<string, unknown>) =>
    axios.post(`/api/snags/${listId}/items`, body).then((r: any) => r.data),
  setStatus: (
    itemId: string,
    status: string,
    extras?: { rejectionReason?: string; fixedDate?: string },
  ) =>
    axios
      .patch(`/api/snags/items/${itemId}/status`, { status, ...extras })
      .then((r: any) => r.data),
  attachPhoto: (itemId: string, s3Key: string, caption?: string, kind: "BEFORE" | "AFTER" = "BEFORE") =>
    axios
      .post(`/api/snags/items/${itemId}/photos`, { s3Key, caption, kind })
      .then((r: any) => r.data),
  deletePhoto: (photoId: string) =>
    axios.delete(`/api/snags/photos/${photoId}`).then((r: any) => r.data),
  deleteItem: (itemId: string) =>
    axios.delete(`/api/snags/items/${itemId}`).then((r: any) => r.data),
};

// ----- Handover -----
// Backend mounts at /api/handover (see apps/api/src/routes/handover.ts).
// `byDeal` is get-or-seed — it always returns a checklist, never 404s for a
// missing-checklist case, so `ensure` is now a thin alias for callers that
// want the create-on-first-access semantics by name.
export const handoverApi = {
  byDeal: (dealId: string) =>
    axios.get(`/api/handover/${dealId}`).then((r: any) => r.data),
  ensure: (dealId: string) =>
    axios.get(`/api/handover/${dealId}`).then((r: any) => r.data),
  setItem: (itemId: string, body: Record<string, unknown>) =>
    axios.patch(`/api/handover/items/${itemId}`, body).then((r: any) => r.data),
  complete: (dealId: string) =>
    axios.post(`/api/handover/${dealId}/complete`).then((r: any) => r.data),
};

// ----- Title deeds -----
export const titleDeedsApi = {
  listForUnit: (unitId: string) =>
    axios.get(`/api/title-deeds/unit/${unitId}`).then((r: any) => r.data.data ?? []),
  create: (body: Record<string, unknown>) =>
    axios.post("/api/title-deeds", body).then((r: any) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    axios.patch(`/api/title-deeds/${id}`, body).then((r: any) => r.data),
  transition: (id: string, newStatus: string) =>
    axios
      .post(`/api/title-deeds/${id}/transition`, { newStatus })
      .then((r: any) => r.data),
};

// ----- SPA -----
export const spaApi = {
  previewUrl: (dealId: string) => `/api/spa/deal/${dealId}/preview`,
  generate: (dealId: string) =>
    axios.post(`/api/spa/deal/${dealId}/generate`).then((r: any) => r.data),
};

// ----- Invoices -----
export const invoicesApi = {
  listForDeal: (dealId: string) =>
    axios.get(`/api/invoices/deal/${dealId}`).then((r: any) => r.data.data ?? []),
  get: (id: string) => axios.get(`/api/invoices/${id}`).then((r: any) => r.data),
  create: (body: Record<string, unknown>) =>
    axios.post("/api/invoices", body).then((r: any) => r.data),
  fromPayment: (paymentId: string) =>
    axios.post(`/api/invoices/from-payment/${paymentId}`).then((r: any) => r.data),
  issue: (id: string) => axios.post(`/api/invoices/${id}/issue`).then((r: any) => r.data),
  markPaid: (id: string) =>
    axios.post(`/api/invoices/${id}/mark-paid`).then((r: any) => r.data),
  cancel: (id: string) => axios.post(`/api/invoices/${id}/cancel`).then((r: any) => r.data),
};

// ----- Receipts -----
export const receiptsApi = {
  listForDeal: (dealId: string) =>
    axios.get(`/api/receipts/deal/${dealId}`).then((r: any) => r.data.data ?? []),
  create: (body: Record<string, unknown>) =>
    axios.post("/api/receipts", body).then((r: any) => r.data),
};

// ----- Refunds -----
export const refundsApi = {
  listOpen: () => axios.get("/api/refunds").then((r: any) => r.data.data ?? []),
  listForDeal: (dealId: string) =>
    axios.get(`/api/refunds/deal/${dealId}`).then((r: any) => r.data.data ?? []),
  get: (id: string) => axios.get(`/api/refunds/${id}`).then((r: any) => r.data),
  request: (body: Record<string, unknown>) =>
    axios.post("/api/refunds", body).then((r: any) => r.data),
  transition: (id: string, body: Record<string, unknown>) =>
    axios.post(`/api/refunds/${id}/transition`, body).then((r: any) => r.data),
};

// ----- Escrow -----
export const escrowApi = {
  accountsForProject: (projectId: string) =>
    axios.get(`/api/escrow/project/${projectId}/accounts`).then((r: any) => r.data.data ?? []),
  createAccount: (body: Record<string, unknown>) =>
    axios.post("/api/escrow/accounts", body).then((r: any) => r.data),
  balance: (accountId: string) =>
    axios.get(`/api/escrow/accounts/${accountId}/balance`).then((r: any) => r.data),
  ledger: (accountId: string, take = 200) =>
    axios
      .get(`/api/escrow/accounts/${accountId}/ledger`, { params: { take } })
      .then((r: any) => r.data.data ?? []),
  postEntry: (accountId: string, body: Record<string, unknown>) =>
    axios.post(`/api/escrow/accounts/${accountId}/entries`, body).then((r: any) => r.data),
};

// ----- Tiered commission -----
export const commissionTiersApi = {
  list: (projectId?: string) =>
    axios
      .get("/api/commission-tiers", { params: projectId ? { projectId } : undefined })
      .then((r: any) => r.data.data ?? []),
  create: (body: Record<string, unknown>) =>
    axios.post("/api/commission-tiers", body).then((r: any) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    axios.patch(`/api/commission-tiers/${id}`, body).then((r: any) => r.data),
  remove: (id: string) =>
    axios.delete(`/api/commission-tiers/${id}`).then((r: any) => r.data),
  resolve: (dealId: string) =>
    axios.get(`/api/commission-tiers/resolve/deal/${dealId}`).then((r: any) => r.data),
  setSplits: (dealId: string, splits: Array<Record<string, unknown>>) =>
    axios
      .put(`/api/commission-tiers/splits/deal/${dealId}`, { splits })
      .then((r: any) => r.data.data),
};
