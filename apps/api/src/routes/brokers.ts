import { Router } from "express";
import multer from "multer";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { validate } from "../middleware/validation";
import {
  createBrokerCompanySchema,
  createBrokerAgentSchema,
} from "../schemas/validation";
import { prisma } from "../lib/prisma";
import { requireAuthentication } from "../middleware/auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52428800 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Allowed: PDF, JPEG, PNG"));
    }
    cb(null, true);
  },
});

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const router = Router();
router.use(requireAuthentication);

// Upload broker file (certificates, EID, etc.)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file provided", code: "NO_FILE", statusCode: 400 });
    }
    const ext = path.extname(req.file.originalname);
    const key = `brokers/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
    res.json({ url, key });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Upload failed", code: "UPLOAD_ERROR", statusCode: 500 });
  }
});

// Get all broker companies
router.get("/companies", async (req, res) => {
  try {
    const companies = await prisma.brokerCompany.findMany({
      include: {
        agents: true,
        deals: { select: { id: true } },
        commissions: { select: { amount: true, status: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json(companies);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch broker companies",
      code: "FETCH_COMPANIES_ERROR",
      statusCode: 500,
    });
  }
});

// Get broker company detail
router.get("/companies/:id", async (req, res) => {
  try {
    const company = await prisma.brokerCompany.findUnique({
      where: { id: req.params.id },
      include: {
        agents: true,
        deals: { include: { lead: true, unit: true } },
        commissions: true,
      },
    });

    if (!company) {
      return res.status(404).json({
        error: "Broker company not found",
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }

    res.json(company);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch broker company",
      code: "FETCH_COMPANY_ERROR",
      statusCode: 500,
    });
  }
});

// Create broker company
router.post(
  "/companies",
  validate(createBrokerCompanySchema),
  async (req, res) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "UNAUTHENTICATED",
          statusCode: 401,
        });
      }

      const {
        name, email, phone,
        reraLicenseNumber, reraLicenseExpiry, tradeLicenseNumber,
        tradeLicenseCopyUrl, vatCertificateNo, vatCertificateUrl,
        corporateTaxCertUrl, officeRegistrationNo, ornCertificateUrl,
        officeManagerBrokerId, website, officeNo, buildingName,
        neighborhood, emirate, postalCode,
        bankName, bankAccountName, bankAccountNo, bankIban, bankCurrency,
        commissionRate,
      } = req.body;

      const company = await prisma.brokerCompany.create({
        data: {
          name, email, phone,
          reraLicenseNumber,
          reraLicenseExpiry: reraLicenseExpiry ? new Date(reraLicenseExpiry) : null,
          tradeLicenseNumber, tradeLicenseCopyUrl,
          vatCertificateNo, vatCertificateUrl,
          corporateTaxCertUrl, officeRegistrationNo, ornCertificateUrl,
          officeManagerBrokerId, website, officeNo, buildingName,
          neighborhood, emirate, postalCode,
          bankName, bankAccountName, bankAccountNo, bankIban, bankCurrency,
          commissionRate: commissionRate || 4,
        },
      });

      res.status(201).json(company);
    } catch (error: any) {
      res.status(400).json({
        error: error.message || "Failed to create broker company",
        code: "COMPANY_CREATE_ERROR",
        statusCode: 400,
      });
    }
  }
);

// Get agents for a specific company (used by lead/deal forms)
router.get("/companies/:companyId/agents", async (req, res) => {
  try {
    const agents = await prisma.brokerAgent.findMany({
      where: { companyId: req.params.companyId },
      orderBy: { name: "asc" },
    });
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agents", code: "FETCH_AGENTS_ERROR", statusCode: 500 });
  }
});

// Get all broker agents
router.get("/agents", async (req, res) => {
  try {
    const agents = await prisma.brokerAgent.findMany({
      include: {
        company: true,
        _count: { select: { deals: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json(agents);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch broker agents",
      code: "FETCH_AGENTS_ERROR",
      statusCode: 500,
    });
  }
});

// Create broker agent
router.post(
  "/agents",
  validate(createBrokerAgentSchema),
  async (req, res) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "UNAUTHENTICATED",
          statusCode: 401,
        });
      }

      const {
        companyId, name, firstName, lastName, email, phone,
        reraCardNumber, reraCardExpiry,
        eidNo, eidExpiry, eidFrontUrl, eidBackUrl, acceptedConsent,
      } = req.body;

      const displayName = [firstName, lastName].filter(Boolean).join(" ") || name || "";

      const agent = await prisma.brokerAgent.create({
        data: {
          companyId,
          name: displayName,
          firstName: firstName || null,
          lastName: lastName || null,
          email,
          phone,
          reraCardNumber: reraCardNumber || null,
          reraCardExpiry: reraCardExpiry ? new Date(reraCardExpiry) : null,
          eidNo: eidNo || null,
          eidExpiry: eidExpiry ? new Date(eidExpiry) : null,
          eidFrontUrl: eidFrontUrl || null,
          eidBackUrl: eidBackUrl || null,
          acceptedConsent: acceptedConsent ?? false,
        },
      });

      res.status(201).json(agent);
    } catch (error: any) {
      res.status(400).json({
        error: error.message || "Failed to create broker agent",
        code: "AGENT_CREATE_ERROR",
        statusCode: 400,
      });
    }
  }
);

// Check expiring RERA licenses
router.get("/compliance/rera-expiring", async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringLicenses = await prisma.brokerCompany.findMany({
      where: {
        reraLicenseExpiry: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        reraLicenseExpiry: true,
      },
      orderBy: { reraLicenseExpiry: "asc" },
    });

    res.json(expiringLicenses);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch expiring licenses",
      code: "FETCH_COMPLIANCE_ERROR",
      statusCode: 500,
    });
  }
});

// Update broker company
router.patch("/companies/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const {
      name, email, phone, commissionRate,
      reraLicenseNumber, reraLicenseExpiry, tradeLicenseNumber,
      tradeLicenseCopyUrl, vatCertificateNo, vatCertificateUrl,
      corporateTaxCertUrl, officeRegistrationNo, ornCertificateUrl,
      officeManagerBrokerId, website, officeNo, buildingName,
      neighborhood, emirate, postalCode,
      bankName, bankAccountName, bankAccountNo, bankIban, bankCurrency,
    } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (commissionRate !== undefined) data.commissionRate = parseFloat(commissionRate);
    if (reraLicenseNumber !== undefined) data.reraLicenseNumber = reraLicenseNumber || null;
    if (reraLicenseExpiry !== undefined) data.reraLicenseExpiry = reraLicenseExpiry ? new Date(reraLicenseExpiry) : null;
    if (tradeLicenseNumber !== undefined) data.tradeLicenseNumber = tradeLicenseNumber || null;
    const strFields = [
      "tradeLicenseCopyUrl", "vatCertificateNo", "vatCertificateUrl",
      "corporateTaxCertUrl", "officeRegistrationNo", "ornCertificateUrl",
      "officeManagerBrokerId", "website", "officeNo", "buildingName",
      "neighborhood", "emirate", "postalCode",
      "bankName", "bankAccountName", "bankAccountNo", "bankIban", "bankCurrency",
    ];
    const bodyVals: Record<string, any> = {
      tradeLicenseCopyUrl, vatCertificateNo, vatCertificateUrl,
      corporateTaxCertUrl, officeRegistrationNo, ornCertificateUrl,
      officeManagerBrokerId, website, officeNo, buildingName,
      neighborhood, emirate, postalCode,
      bankName, bankAccountName, bankAccountNo, bankIban, bankCurrency,
    };
    for (const f of strFields) {
      if (bodyVals[f] !== undefined) data[f] = bodyVals[f] || null;
    }
    const company = await prisma.brokerCompany.update({ where: { id: req.params.id }, data });
    res.json(company);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update company", code: "COMPANY_UPDATE_ERROR", statusCode: 400 });
  }
});

// Delete broker company
router.delete("/companies/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const company = await prisma.brokerCompany.findUnique({ where: { id: req.params.id }, include: { deals: true } });
    if (!company) {
      return res.status(404).json({ error: "Company not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (company.deals.length > 0) {
      return res.status(400).json({ error: "Cannot delete company with active deals", code: "COMPANY_HAS_DEALS", statusCode: 400 });
    }
    await prisma.brokerCompany.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete company", code: "COMPANY_DELETE_ERROR", statusCode: 400 });
  }
});

// Update broker agent (RERA card, contact details)
router.patch("/agents/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const {
      name, firstName, lastName, email, phone,
      reraCardNumber, reraCardExpiry,
      eidNo, eidExpiry, eidFrontUrl, eidBackUrl, acceptedConsent,
    } = req.body;
    const data: any = {};
    if (firstName !== undefined) data.firstName = firstName || null;
    if (lastName !== undefined) data.lastName = lastName || null;
    if (firstName !== undefined || lastName !== undefined || name !== undefined) {
      data.name = [firstName, lastName].filter(Boolean).join(" ") || name || undefined;
    }
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (reraCardNumber !== undefined) data.reraCardNumber = reraCardNumber || null;
    if (reraCardExpiry !== undefined) data.reraCardExpiry = reraCardExpiry ? new Date(reraCardExpiry) : null;
    if (eidNo !== undefined) data.eidNo = eidNo || null;
    if (eidExpiry !== undefined) data.eidExpiry = eidExpiry ? new Date(eidExpiry) : null;
    if (eidFrontUrl !== undefined) data.eidFrontUrl = eidFrontUrl || null;
    if (eidBackUrl !== undefined) data.eidBackUrl = eidBackUrl || null;
    if (acceptedConsent !== undefined) data.acceptedConsent = acceptedConsent;
    const agent = await prisma.brokerAgent.update({ where: { id: req.params.id }, data });
    res.json(agent);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update agent", code: "AGENT_UPDATE_ERROR", statusCode: 400 });
  }
});

// Remove broker agent — only allowed if agent has no deals
router.delete("/agents/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const agent = await prisma.brokerAgent.findUnique({
      where: { id: req.params.id },
      include: { deals: { select: { id: true }, take: 1 }, leads: { select: { id: true }, take: 1 } },
    });
    if (!agent) {
      return res.status(404).json({ error: "Agent not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (agent.deals.length > 0 || agent.leads.length > 0) {
      return res.status(400).json({ error: "Cannot delete agent with existing leads or deals. Remove the agent from those records first.", code: "AGENT_HAS_RECORDS", statusCode: 400 });
    }
    await prisma.brokerAgent.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete agent", code: "AGENT_DELETE_ERROR", statusCode: 400 });
  }
});

export default router;
