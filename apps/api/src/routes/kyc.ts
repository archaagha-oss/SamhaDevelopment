import { Router } from "express";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { updateKycSchema, addKycDocumentSchema } from "../schemas/validation";
import {
  getOrCreateKyc,
  updateKyc,
  addDocument,
  removeDocument,
  KycError,
} from "../services/kycService";

const router = Router();

// KYC is an internal CRM operation — every endpoint requires auth.
router.use(requireAuthentication);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callerId(req: any): string {
  return req.resolvedUser?.id ?? req.auth!.userId;
}

function sendError(res: any, err: any) {
  if (err instanceof KycError) {
    return res.status(err.statusCode).json({
      error:      err.message,
      code:       err.code,
      statusCode: err.statusCode,
    });
  }
  return res.status(500).json({
    error:      err?.message ?? "Internal server error",
    code:       "INTERNAL_ERROR",
    statusCode: 500,
  });
}

// ---------------------------------------------------------------------------
// GET /:leadId — get-or-seed the KYC record for a lead
// ---------------------------------------------------------------------------

router.get("/:leadId", async (req, res) => {
  try {
    const kyc = await getOrCreateKyc(req.params.leadId);
    res.json(kyc);
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:kycId — update verification flags / status / notes
// ---------------------------------------------------------------------------

router.patch(
  "/:kycId",
  requireRole(["ADMIN", "MANAGER"]),
  validate(updateKycSchema),
  async (req, res) => {
    try {
      const kyc = await updateKyc(req.params.kycId, req.body, callerId(req));
      res.json(kyc);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:kycId/documents — attach a supporting document (S3-backed)
// ---------------------------------------------------------------------------

router.post(
  "/:kycId/documents",
  requireRole(["ADMIN", "MANAGER"]),
  validate(addKycDocumentSchema),
  async (req, res) => {
    try {
      const doc = await addDocument(req.params.kycId, req.body, callerId(req));
      res.json(doc);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /documents/:documentId — hard-delete a document row
// ---------------------------------------------------------------------------

router.delete(
  "/documents/:documentId",
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const result = await removeDocument(req.params.documentId, callerId(req));
      res.json(result);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

export default router;
