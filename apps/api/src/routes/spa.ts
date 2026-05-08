import { Router } from "express";
import {
  buildSPASnapshot,
  renderSPAHtml,
  generateSPADocument,
} from "../services/spaTemplateService";

const router = Router();
const userIdFromReq = (req: any) => req.auth?.userId ?? "system";

// Preview the SPA HTML in the browser without persisting a Document.
router.get("/deal/:dealId/preview", async (req, res) => {
  try {
    const snap = await buildSPASnapshot(req.params.dealId);
    const html = renderSPAHtml(snap);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

// Generate + persist an SPA Document version.
router.post("/deal/:dealId/generate", async (req, res) => {
  try {
    const result = await generateSPADocument(req.params.dealId, userIdFromReq(req));
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: "BAD_REQUEST", statusCode: 400 });
  }
});

export default router;
