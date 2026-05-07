import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const DEFAULT_ORG_ID = "org_default";

// ─── Get settings ────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) {
      return res.status(404).json({ error: "Organization not found", code: "NOT_FOUND", statusCode: 404 });
    }

    let settings = await prisma.appSettings.findUnique({
      where: { organizationId: org.id },
    });

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          organizationId: org.id,
          companyName: org.name,
          timezone: org.timezone,
          currency: org.currency,
        },
      });
    }

    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Update settings ─────────────────────────────────────────────────────────

router.patch("/", async (req, res) => {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) {
      return res.status(404).json({ error: "Organization not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const {
      companyName,
      logoUrl,
      primaryColor,
      timezone,
      currency,
      dateFormat,
      defaultFromEmail,
      defaultFromName,
      whatsappNumber,
      smsProvider,
      emailProvider,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      paymentInstructions,
      emailTemplates,
      notificationPrefs,
      twilioWhatsappFrom,
      twilioMessagingServiceSid,
      twilioWhatsappContentSidBeforeDue,
      twilioWhatsappContentSidOnDue,
      twilioWhatsappContentSidOverdue7,
      twilioWhatsappContentSidOverdue30,
    } = req.body;

    const settings = await prisma.appSettings.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        companyName,
        logoUrl,
        primaryColor,
        timezone:         timezone   ?? org.timezone,
        currency:         currency   ?? org.currency,
        dateFormat,
        defaultFromEmail,
        defaultFromName,
        whatsappNumber,
        smsProvider,
        emailProvider,
        smtpHost,
        smtpPort:    smtpPort ? Number(smtpPort) : undefined,
        smtpUsername,
        smtpPassword,
        paymentInstructions,
        emailTemplates,
        notificationPrefs,
        twilioWhatsappFrom,
        twilioMessagingServiceSid,
        twilioWhatsappContentSidBeforeDue,
        twilioWhatsappContentSidOnDue,
        twilioWhatsappContentSidOverdue7,
        twilioWhatsappContentSidOverdue30,
      },
      update: {
        ...(companyName           !== undefined && { companyName }),
        ...(logoUrl               !== undefined && { logoUrl }),
        ...(primaryColor          !== undefined && { primaryColor }),
        ...(timezone              !== undefined && { timezone }),
        ...(currency              !== undefined && { currency }),
        ...(dateFormat            !== undefined && { dateFormat }),
        ...(defaultFromEmail      !== undefined && { defaultFromEmail }),
        ...(defaultFromName       !== undefined && { defaultFromName }),
        ...(whatsappNumber        !== undefined && { whatsappNumber }),
        ...(smsProvider           !== undefined && { smsProvider }),
        ...(emailProvider         !== undefined && { emailProvider }),
        ...(smtpHost              !== undefined && { smtpHost }),
        ...(smtpPort              !== undefined && { smtpPort: Number(smtpPort) }),
        ...(smtpUsername          !== undefined && { smtpUsername }),
        ...(smtpPassword          !== undefined && { smtpPassword }),
        ...(paymentInstructions   !== undefined && { paymentInstructions }),
        ...(emailTemplates        !== undefined && { emailTemplates }),
        ...(notificationPrefs     !== undefined && { notificationPrefs }),
        ...(twilioWhatsappFrom                !== undefined && { twilioWhatsappFrom }),
        ...(twilioMessagingServiceSid         !== undefined && { twilioMessagingServiceSid }),
        ...(twilioWhatsappContentSidBeforeDue !== undefined && { twilioWhatsappContentSidBeforeDue }),
        ...(twilioWhatsappContentSidOnDue     !== undefined && { twilioWhatsappContentSidOnDue }),
        ...(twilioWhatsappContentSidOverdue7  !== undefined && { twilioWhatsappContentSidOverdue7 }),
        ...(twilioWhatsappContentSidOverdue30 !== undefined && { twilioWhatsappContentSidOverdue30 }),
      },
    } as any);

    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

export default router;
