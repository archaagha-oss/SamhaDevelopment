import { Router } from "express";
import {
  createEscrowAccount,
  listEscrowAccountsForProject,
  postEntry,
  getAccountBalance,
  listLedgerEntries,
} from "../services/escrowService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

router.get("/project/:projectId/accounts", async (req, res) => {
  try {
    const accounts = await listEscrowAccountsForProject(req.params.projectId);
    res.json({ data: accounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/accounts", async (req, res) => {
  try {
    const acc = await createEscrowAccount(req.body);
    res.status(201).json(acc);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

router.get("/accounts/:accountId/balance", async (req, res) => {
  try {
    const balance = await getAccountBalance(req.params.accountId);
    res.json(balance);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.get("/accounts/:accountId/ledger", async (req, res) => {
  try {
    const entries = await listLedgerEntries(req.params.accountId, Number(req.query.take) || 200);
    res.json({ data: entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

router.post("/accounts/:accountId/entries", async (req, res) => {
  try {
    const entry = await postEntry({ ...req.body, accountId: req.params.accountId }, userIdFromReq(req));
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
