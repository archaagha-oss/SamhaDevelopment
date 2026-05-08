/**
 * Phase 2/3 API client — thin axios wrappers grouped by resource.
 * Each function returns the typed response.data so callers don't unwrap.
 */
import axios from "axios";
// ----- KYC -----
export const kycApi = {
    listForLead: (leadId) => axios.get(`/api/kyc/lead/${leadId}`).then((r) => r.data.data ?? []),
    get: (id) => axios.get(`/api/kyc/${id}`).then((r) => r.data),
    create: (leadId, body) => axios.post(`/api/kyc/lead/${leadId}`, body).then((r) => r.data),
    update: (id, body) => axios.patch(`/api/kyc/${id}`, body).then((r) => r.data),
    remove: (id) => axios.delete(`/api/kyc/${id}`).then((r) => r.data),
};
// ----- Deal parties -----
export const dealPartiesApi = {
    list: (dealId) => axios.get(`/api/deal-parties/deal/${dealId}`).then((r) => r.data.data ?? []),
    replace: (dealId, parties) => axios
        .put(`/api/deal-parties/deal/${dealId}`, { parties })
        .then((r) => r.data.data),
};
// ----- Phases -----
export const phasesApi = {
    listForProject: (projectId) => axios.get(`/api/phases/project/${projectId}`).then((r) => r.data.data ?? []),
    create: (body) => axios.post("/api/phases", body).then((r) => r.data),
    update: (id, body) => axios.patch(`/api/phases/${id}`, body).then((r) => r.data),
    changeReleaseStage: (id, newStage, reason) => axios
        .post(`/api/phases/${id}/release-stage`, { newStage, reason })
        .then((r) => r.data),
    remove: (id) => axios.delete(`/api/phases/${id}`).then((r) => r.data),
};
// ----- Unit type plans -----
export const typePlansApi = {
    listForProject: (projectId) => axios.get(`/api/unit-type-plans/project/${projectId}`).then((r) => r.data.data ?? []),
    create: (body) => axios.post("/api/unit-type-plans", body).then((r) => r.data),
    update: (id, body) => axios.patch(`/api/unit-type-plans/${id}`, body).then((r) => r.data),
    remove: (id) => axios.delete(`/api/unit-type-plans/${id}`).then((r) => r.data),
};
// ----- Construction milestones -----
export const constructionApi = {
    listForProject: (projectId) => axios.get(`/api/construction/project/${projectId}`).then((r) => r.data.data ?? []),
    create: (body) => axios.post("/api/construction", body).then((r) => r.data),
    updatePercent: (id, percentComplete) => axios.patch(`/api/construction/${id}/percent`, { percentComplete }).then((r) => r.data),
};
// ----- Snags -----
export const snagsApi = {
    listForUnit: (unitId) => axios.get(`/api/snags/unit/${unitId}`).then((r) => r.data.data ?? []),
    createList: (unitId, label) => axios.post(`/api/snags/unit/${unitId}`, { label }).then((r) => r.data),
    addItem: (listId, body) => axios.post(`/api/snags/${listId}/items`, body).then((r) => r.data),
    setStatus: (itemId, status, extras) => axios
        .patch(`/api/snags/items/${itemId}/status`, { status, ...extras })
        .then((r) => r.data),
    attachPhoto: (itemId, s3Key, caption, kind = "BEFORE") => axios
        .post(`/api/snags/items/${itemId}/photos`, { s3Key, caption, kind })
        .then((r) => r.data),
    deletePhoto: (photoId) => axios.delete(`/api/snags/photos/${photoId}`).then((r) => r.data),
    deleteItem: (itemId) => axios.delete(`/api/snags/items/${itemId}`).then((r) => r.data),
};
// ----- Handover -----
export const handoverApi = {
    byDeal: (dealId) => axios.get(`/api/handover/deal/${dealId}`).then((r) => r.data),
    ensure: (dealId) => axios.post(`/api/handover/deal/${dealId}`).then((r) => r.data),
    setItem: (itemId, body) => axios.patch(`/api/handover/items/${itemId}`, body).then((r) => r.data),
    ready: (dealId) => axios.get(`/api/handover/deal/${dealId}/ready`).then((r) => r.data),
    complete: (checklistId, body) => axios.post(`/api/handover/${checklistId}/complete`, body ?? {}).then((r) => r.data),
};
// ----- Title deeds -----
export const titleDeedsApi = {
    listForUnit: (unitId) => axios.get(`/api/title-deeds/unit/${unitId}`).then((r) => r.data.data ?? []),
    create: (body) => axios.post("/api/title-deeds", body).then((r) => r.data),
    update: (id, body) => axios.patch(`/api/title-deeds/${id}`, body).then((r) => r.data),
    transition: (id, newStatus) => axios
        .post(`/api/title-deeds/${id}/transition`, { newStatus })
        .then((r) => r.data),
};
// ----- SPA -----
export const spaApi = {
    previewUrl: (dealId) => `/api/spa/deal/${dealId}/preview`,
    generate: (dealId) => axios.post(`/api/spa/deal/${dealId}/generate`).then((r) => r.data),
};
// ----- Invoices -----
export const invoicesApi = {
    listForDeal: (dealId) => axios.get(`/api/invoices/deal/${dealId}`).then((r) => r.data.data ?? []),
    get: (id) => axios.get(`/api/invoices/${id}`).then((r) => r.data),
    create: (body) => axios.post("/api/invoices", body).then((r) => r.data),
    fromPayment: (paymentId) => axios.post(`/api/invoices/from-payment/${paymentId}`).then((r) => r.data),
    issue: (id) => axios.post(`/api/invoices/${id}/issue`).then((r) => r.data),
    markPaid: (id) => axios.post(`/api/invoices/${id}/mark-paid`).then((r) => r.data),
    cancel: (id) => axios.post(`/api/invoices/${id}/cancel`).then((r) => r.data),
};
// ----- Receipts -----
export const receiptsApi = {
    listForDeal: (dealId) => axios.get(`/api/receipts/deal/${dealId}`).then((r) => r.data.data ?? []),
    create: (body) => axios.post("/api/receipts", body).then((r) => r.data),
};
// ----- Refunds -----
export const refundsApi = {
    listOpen: () => axios.get("/api/refunds").then((r) => r.data.data ?? []),
    listForDeal: (dealId) => axios.get(`/api/refunds/deal/${dealId}`).then((r) => r.data.data ?? []),
    get: (id) => axios.get(`/api/refunds/${id}`).then((r) => r.data),
    request: (body) => axios.post("/api/refunds", body).then((r) => r.data),
    transition: (id, body) => axios.post(`/api/refunds/${id}/transition`, body).then((r) => r.data),
};
// ----- Escrow -----
export const escrowApi = {
    accountsForProject: (projectId) => axios.get(`/api/escrow/project/${projectId}/accounts`).then((r) => r.data.data ?? []),
    createAccount: (body) => axios.post("/api/escrow/accounts", body).then((r) => r.data),
    balance: (accountId) => axios.get(`/api/escrow/accounts/${accountId}/balance`).then((r) => r.data),
    ledger: (accountId, take = 200) => axios
        .get(`/api/escrow/accounts/${accountId}/ledger`, { params: { take } })
        .then((r) => r.data.data ?? []),
    postEntry: (accountId, body) => axios.post(`/api/escrow/accounts/${accountId}/entries`, body).then((r) => r.data),
};
// ----- Tiered commission -----
export const commissionTiersApi = {
    list: (projectId) => axios
        .get("/api/commission-tiers", { params: projectId ? { projectId } : undefined })
        .then((r) => r.data.data ?? []),
    create: (body) => axios.post("/api/commission-tiers", body).then((r) => r.data),
    update: (id, body) => axios.patch(`/api/commission-tiers/${id}`, body).then((r) => r.data),
    remove: (id) => axios.delete(`/api/commission-tiers/${id}`).then((r) => r.data),
    resolve: (dealId) => axios.get(`/api/commission-tiers/resolve/deal/${dealId}`).then((r) => r.data),
    setSplits: (dealId, splits) => axios
        .put(`/api/commission-tiers/splits/deal/${dealId}`, { splits })
        .then((r) => r.data.data),
};
