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
export const constructionApi = {
  listForProject: (projectId: string) =>
    axios.get(`/api/construction/project/${projectId}`).then((r: any) => r.data.data ?? []),
  create: (body: Record<string, unknown>) =>
    axios.post("/api/construction", body).then((r: any) => r.data),
  updatePercent: (id: string, percentComplete: number) =>
    axios.patch(`/api/construction/${id}/percent`, { percentComplete }).then((r: any) => r.data),
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
// Backend mounts at /api/escrow (apps/api/src/routes/escrow.ts).
// The new design is project- and deal-scoped: there's no separate "ledger
// account" abstraction — entries credit/debit a project's escrow account
// (configured on ProjectBankAccount) per deal.
//
// `accountsForProject` resolves the ProjectBankAccount rows with
// purpose=ESCROW so the UI can show the bank metadata (IBAN, name) of the
// account the entries reconcile against. `balance` / `ledger` /
// `postEntry` work against the transactional ledger endpoints.
export const escrowApi = {
  // Project-level bank accounts (purpose=ESCROW) — used for header / picker.
  accountsForProject: (projectId: string) =>
    axios
      .get(`/api/projects/${projectId}/bank-accounts`)
      .then((r: any) => {
        const all = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
        return all.filter((a: any) => a.purpose === "ESCROW");
      }),
  // Project-wide balance + recent transactions.
  balance: (projectId: string) =>
    axios
      .get(`/api/escrow/project/${projectId}`)
      .then((r: any) => r.data.balance ?? { credits: 0, debits: 0, balance: 0 }),
  ledger: (projectId: string, take = 200) =>
    axios
      .get(`/api/escrow/project/${projectId}`, { params: { take } })
      .then((r: any) => r.data.transactions ?? []),
  // Per-deal variants (used by deal-detail views).
  balanceForDeal: (dealId: string) =>
    axios
      .get(`/api/escrow/deal/${dealId}`)
      .then((r: any) => r.data.balance ?? { credits: 0, debits: 0, balance: 0 }),
  ledgerForDeal: (dealId: string, take = 200) =>
    axios
      .get(`/api/escrow/deal/${dealId}`, { params: { take } })
      .then((r: any) => r.data.transactions ?? []),
  // Record a new entry. Body must include { dealId, type, amount, transactionDate }
  // plus optional reference / paymentId / notes / bankAccountId.
  postEntry: (body: Record<string, unknown>) =>
    axios.post(`/api/escrow/transactions`, body).then((r: any) => r.data),
  updateEntry: (id: string, body: Record<string, unknown>) =>
    axios.patch(`/api/escrow/transactions/${id}`, body).then((r: any) => r.data),
  deleteEntry: (id: string) =>
    axios.delete(`/api/escrow/transactions/${id}`).then((r: any) => r.data),
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
