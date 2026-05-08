import { Router } from "express";
import { buildPortalFeed, PortalName } from "../services/portalFeedService";
import { logger } from "../lib/logger";

const router = Router();

// ============================================================
// Portal XML feeds (public — portals poll these on a schedule)
// ============================================================
// These endpoints are deliberately unauthenticated: Bayut, Property Finder,
// and Dubizzle pull them anonymously from a public URL. The feeds only
// contain units explicitly opted-in via Unit.portalEnabled = true and
// require Unit.trakheesiPermit to be set (DLD compliance).
//
// Configure the URLs in each portal's listing dashboard, e.g.:
//   https://crm.example.com/api/feeds/bayut.xml
//   https://crm.example.com/api/feeds/propertyfinder.xml
//   https://crm.example.com/api/feeds/dubizzle.xml
// ============================================================

const FEED_TOKEN = process.env.PORTAL_FEED_TOKEN || "";

function checkToken(req: any): boolean {
  if (!FEED_TOKEN) return true; // disabled if no token configured
  const provided = (req.query?.token as string) || (req.headers["x-feed-token"] as string) || "";
  return provided === FEED_TOKEN;
}

async function serveFeed(req: any, res: any, portal: PortalName) {
  if (!checkToken(req)) {
    return res.status(403).type("text/plain").send("Forbidden");
  }
  try {
    const xml = await buildPortalFeed(portal);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300"); // 5-minute edge cache
    res.send(xml);
  } catch (err) {
    logger.error(`[feeds] failed to build ${portal} feed`, { err: (err as Error).message });
    res.status(500).type("text/plain").send("Failed to build feed");
  }
}

router.get("/bayut.xml", (req, res) => serveFeed(req, res, "bayut"));
router.get("/propertyfinder.xml", (req, res) => serveFeed(req, res, "propertyfinder"));
router.get("/dubizzle.xml", (req, res) => serveFeed(req, res, "dubizzle"));

export default router;
