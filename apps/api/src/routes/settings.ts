import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validation";
import {
  brandingSchema,
  localizationSchema,
  communicationSchema,
  financeSchema,
  templatesSchema,
  notificationsSchema,
  testSmtpSchema,
  previewTemplateSchema,
} from "../schemas/settings";
import {
  loadOrCreateSettings,
  toPublicSettings,
  recordAudit,
  diffFields,
  applyCommunicationPatch,
} from "../services/settingsService";
import {
  sendEmail,
  buildBeforeDueEmail,
  buildOnDueEmail,
  buildOverdueEmail,
  refreshSettingsCache,
} from "../services/mailerService";

const router = Router();

const ADMIN_ONLY = ["ADMIN"];

// All settings endpoints require auth.
router.use(requireAuthentication);

// ─── Read ────────────────────────────────────────────────────────────────────

router.get("/", async (_req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    res.json(toPublicSettings(settings));
  } catch (err) {
    next(err);
  }
});

// ─── Per-section update helpers ─────────────────────────────────────────────

const userIdFrom = (req: any): string | null =>
  req.resolvedUser?.id ?? req.auth?.userId ?? null;

router.patch("/branding", requireRole(ADMIN_ONLY), validate(brandingSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const data = { ...req.body };
    // Empty strings clear the field.
    for (const k of Object.keys(data)) if (data[k] === "") data[k] = null;
    const changed = diffFields(settings, data);
    const updated = await prisma.appSettings.update({ where: { id: settings.id }, data });
    recordAudit({ userId: userIdFrom(req), section: "branding", changedFields: changed });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/localization", requireRole(ADMIN_ONLY), validate(localizationSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const changed = diffFields(settings, req.body);
    const updated = await prisma.appSettings.update({ where: { id: settings.id }, data: req.body });
    recordAudit({ userId: userIdFrom(req), section: "localization", changedFields: changed });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/communication", requireRole(ADMIN_ONLY), validate(communicationSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const data = applyCommunicationPatch(req.body);
    const changed = diffFields(settings, data);
    const updated = await prisma.appSettings.update({ where: { id: settings.id }, data });
    recordAudit({ userId: userIdFrom(req), section: "communication", changedFields: changed });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/finance", requireRole(ADMIN_ONLY), validate(financeSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const changed = diffFields(settings, req.body);
    const updated = await prisma.appSettings.update({ where: { id: settings.id }, data: req.body });
    recordAudit({ userId: userIdFrom(req), section: "finance", changedFields: changed });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/templates", requireRole(ADMIN_ONLY), validate(templatesSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const merged = { ...(settings.emailTemplates as any ?? {}), ...req.body.emailTemplates };
    const changed = Object.keys(req.body.emailTemplates);
    const updated = await prisma.appSettings.update({
      where: { id: settings.id },
      data:  { emailTemplates: merged },
    });
    recordAudit({ userId: userIdFrom(req), section: "templates", changedFields: changed });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

router.patch("/notifications", requireRole(ADMIN_ONLY), validate(notificationsSchema), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const merged = { ...(settings.notificationPrefs as any ?? {}), ...req.body.notificationPrefs };
    const changed = Object.keys(req.body.notificationPrefs);
    const updated = await prisma.appSettings.update({
      where: { id: settings.id },
      data:  { notificationPrefs: merged },
    });
    recordAudit({ userId: userIdFrom(req), section: "notifications", changedFields: changed });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

// ─── Test endpoints ─────────────────────────────────────────────────────────

router.post("/test-smtp", requireRole(ADMIN_ONLY), validate(testSmtpSchema), async (req, res, next) => {
  try {
    const result = await sendEmail({
      to: req.body.to,
      subject: "Samha CRM — SMTP test message",
      text: "If you received this, your SMTP configuration is working.",
      html: "<p>If you received this, your SMTP configuration is working.</p>",
    });
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

router.post("/templates/preview", requireRole(ADMIN_ONLY), validate(previewTemplateSchema), async (req, res, next) => {
  try {
    await refreshSettingsCache();
    const sampleVars = {
      buyerName:      req.body.vars?.buyerName      ?? "John Doe",
      unitNumber:     req.body.vars?.unitNumber     ?? "A-1204",
      projectName:    req.body.vars?.projectName    ?? "Marina Heights",
      milestoneLabel: req.body.vars?.milestoneLabel ?? "1st installment (10%)",
      dueDate:        req.body.vars?.dueDate        ?? "30 June 2026",
      amount:         req.body.vars?.amount         ?? "AED 250,000",
    };
    let preview;
    if (req.body.key === "beforeDue")     preview = buildBeforeDueEmail(sampleVars);
    else if (req.body.key === "onDue")    preview = buildOnDueEmail(sampleVars);
    else if (req.body.key === "overdue7") preview = buildOverdueEmail(sampleVars, 7);
    else                                  preview = buildOverdueEmail(sampleVars, 30);
    res.json(preview);
  } catch (err) { next(err); }
});

// ─── Backwards-compat: keep the old PATCH / for clients that still send
// the whole bundle. New clients should use the per-section endpoints.
// ─────────────────────────────────────────────────────────────────────────────

router.patch("/", requireRole(ADMIN_ONLY), async (req, res, next) => {
  try {
    const { settings } = await loadOrCreateSettings();
    const data: Record<string, any> = {};

    // Branding / localization / finance pass through
    const passthrough = [
      "companyName", "logoUrl", "primaryColor",
      "timezone", "currency", "dateFormat",
      "paymentInstructions",
    ];
    for (const k of passthrough) if (req.body[k] !== undefined) data[k] = req.body[k];

    // Communication uses the patch-aware helper.
    Object.assign(data, applyCommunicationPatch(req.body));

    if (req.body.emailTemplates !== undefined) {
      data.emailTemplates = { ...(settings.emailTemplates as any ?? {}), ...req.body.emailTemplates };
    }
    if (req.body.notificationPrefs !== undefined) {
      data.notificationPrefs = { ...(settings.notificationPrefs as any ?? {}), ...req.body.notificationPrefs };
    }

    const changed = diffFields(settings, data);
    const updated = await prisma.appSettings.update({ where: { id: settings.id }, data });
    recordAudit({ userId: userIdFrom(req), section: "branding", changedFields: changed });
    res.json(toPublicSettings(updated));
  } catch (err) { next(err); }
});

export default router;
