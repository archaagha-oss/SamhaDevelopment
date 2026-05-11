import { Router } from "express";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import {
  recordEscrowTransactionSchema,
  updateEscrowTransactionSchema,
} from "../schemas/validation";
import {
  recordTransaction,
  getDealBalance,
  getProjectBalance,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  EscrowError,
} from "../services/escrowService";

const router = Router();

// Escrow is an internal CRM operation — every endpoint requires auth.
router.use(requireAuthentication);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callerId(req: any): string {
  return req.resolvedUser?.id ?? req.auth!.userId;
}

function sendError(res: any, err: any) {
  if (err instanceof EscrowError) {
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

function parseRange(req: any) {
  const { from, to, cursor, take } = req.query;
  return {
    from:   typeof from === "string" && from   ? from   : undefined,
    to:     typeof to   === "string" && to     ? to     : undefined,
    cursor: typeof cursor === "string" && cursor ? cursor : null,
    take:   typeof take === "string" && take ? Number(take) : undefined,
  };
}

// ---------------------------------------------------------------------------
// GET /deal/:dealId — balance + recent transactions for one deal
// ---------------------------------------------------------------------------

router.get("/deal/:dealId", async (req, res) => {
  try {
    const { dealId } = req.params;
    const { from, to, cursor, take } = parseRange(req);

    const [balance, page] = await Promise.all([
      getDealBalance(dealId),
      listTransactions({ dealId, from, to }, { cursor, take }),
    ]);

    res.json({
      balance,
      transactions: page.data,
      nextCursor:   page.nextCursor,
    });
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /project/:projectId — balance + recent transactions project-wide
// ---------------------------------------------------------------------------

router.get("/project/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { from, to, cursor, take } = parseRange(req);

    const [balance, page] = await Promise.all([
      getProjectBalance(projectId),
      listTransactions({ projectId, from, to }, { cursor, take }),
    ]);

    res.json({
      balance,
      transactions: page.data,
      nextCursor:   page.nextCursor,
    });
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /transactions — record a new credit/debit entry (ADMIN/MANAGER)
// ---------------------------------------------------------------------------

router.post(
  "/transactions",
  requireRole(["ADMIN", "MANAGER"]),
  validate(recordEscrowTransactionSchema),
  async (req, res) => {
    try {
      const tx = await recordTransaction(req.body, callerId(req));
      res.status(201).json(tx);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /transactions/:id — limited edit (reference / notes only)
// ---------------------------------------------------------------------------
//
// Amount and transactionDate are intentionally immutable once recorded —
// escrow auditability says a misposted entry should be reversed with an
// offsetting transaction, not silently rewritten.

router.patch(
  "/transactions/:id",
  requireRole(["ADMIN", "MANAGER"]),
  validate(updateEscrowTransactionSchema),
  async (req, res) => {
    try {
      const tx = await updateTransaction(req.params.id, req.body);
      res.json(tx);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /transactions/:id — ADMIN only, with audit log line
// ---------------------------------------------------------------------------

router.delete(
  "/transactions/:id",
  requireRole(["ADMIN"]),
  async (req, res) => {
    try {
      const out = await deleteTransaction(req.params.id, callerId(req));
      res.json(out);
    } catch (err: any) {
      sendError(res, err);
    }
  },
);

export default router;
