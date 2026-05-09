import { Router } from "express";
import multer from "multer";
import { documentService } from "../services/documentService";
import { prisma } from "../lib/prisma";
import { requireAuthentication } from "../middleware/auth";

const router = Router();
router.use(requireAuthentication);

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];
const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || "52428800"); // 50MB default
const MAX_FILES_PER_UPLOAD = 5;
const MAX_FILES_PER_DEAL = 100;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Allowed: PDF, DOC, DOCX, JPEG, PNG"));
    }
    cb(null, true);
  },
});

// POST /api/documents/upload - Upload document for deal
router.post("/upload", upload.single("file"), async (req, res) => {
  const startTime = Date.now();
  const userId = req.auth?.userId || "unknown";

  try {
    // Validate auth
    if (!req.auth?.userId) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHENTICATED",
        statusCode: 401,
      });
    }

    // Validate file exists
    if (!req.file) {
      return res.status(400).json({
        error: "No file provided",
        code: "NO_FILE",
        statusCode: 400,
      });
    }

    // Validate dealId
    if (!req.body.dealId || typeof req.body.dealId !== "string") {
      return res.status(400).json({
        error: "Valid dealId required",
        code: "INVALID_DEAL_ID",
        statusCode: 400,
      });
    }

    // Validate document type — must match Prisma DocumentType enum
    const validTypes = ["PASSPORT", "EMIRATES_ID", "VISA", "RESERVATION_FORM", "SPA", "OQOOD_CERTIFICATE", "PAYMENT_RECEIPT", "OTHER"];
    const docType = req.body.type || "OTHER";
    if (!validTypes.includes(docType)) {
      return res.status(400).json({
        error: `Invalid document type. Allowed: ${validTypes.join(", ")}`,
        code: "INVALID_DOC_TYPE",
        statusCode: 400,
      });
    }

    // Verify deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: req.body.dealId },
      select: { id: true, stage: true },
    });
    if (!deal) {
      return res.status(404).json({
        error: "Deal not found",
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }

    // Check file count limit for deal
    const existingCount = await prisma.document.count({
      where: { dealId: req.body.dealId },
    });
    if (existingCount >= MAX_FILES_PER_DEAL) {
      return res.status(400).json({
        error: `Maximum ${MAX_FILES_PER_DEAL} documents per deal exceeded`,
        code: "DOC_LIMIT_EXCEEDED",
        statusCode: 400,
      });
    }

    // Validate expiry date if provided
    if (req.body.expiryDate) {
      const expiryDate = new Date(req.body.expiryDate);
      if (expiryDate < new Date()) {
        return res.status(400).json({
          error: "Expiry date cannot be in the past",
          code: "INVALID_EXPIRY",
          statusCode: 400,
        });
      }
    }

    // Upload to S3
    const { key } = await documentService.uploadFile(req.file, req.body.dealId);

    // Create database record
    const document = await prisma.document.create({
      data: {
        dealId: req.body.dealId,
        name: req.file.originalname,
        type: docType,
        mimeType: req.file.mimetype,
        key,
        uploadedBy: userId,
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
      },
    });

    const duration = Date.now() - startTime;
    console.log(
      `[Document Upload Completed] dealId=${req.body.dealId}, docId=${document.id}, size=${req.file.size}B, duration=${duration}ms, user=${userId}`
    );

    res.status(201).json(document);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("[Document Upload Failed]", {
      dealId: req.body?.dealId,
      userId,
      fileName: req.file?.originalname,
      error: error.message,
      duration: `${duration}ms`,
    });

    // Map specific errors to user-friendly messages
    let statusCode = 400;
    let errorCode = "DOCUMENT_UPLOAD_ERROR";
    let errorMsg = error.message || "Failed to upload document";

    if (error.message.includes("S3 bucket not found")) {
      statusCode = 503;
      errorCode = "SERVICE_UNAVAILABLE";
    } else if (error.message.includes("Invalid AWS credentials")) {
      statusCode = 503;
      errorCode = "SERVICE_CONFIGURATION_ERROR";
    }

    res.status(statusCode).json({
      error: errorMsg,
      code: errorCode,
      statusCode: statusCode,
    });
  }
});

// GET /api/documents — All documents (global view for ContractsPage)
router.get("/", async (req, res) => {
  try {
    const { type, contractStatus, dealId } = req.query;
    const where: any = { softDeleted: false };
    if (type) where.type = type;
    if (contractStatus) where.contractStatus = contractStatus;
    if (dealId) where.dealId = dealId;

    const documents = await (prisma.document as any).findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, dealId: true, name: true, type: true,
        contractStatus: true, mimeType: true, uploadedBy: true,
        expiryDate: true, createdAt: true,
        deal: {
          select: {
            dealNumber: true,
            stage: true,
            lead: { select: { firstName: true, lastName: true } },
            unit: { select: { unitNumber: true } },
          },
        },
      },
    });
    res.json({ data: documents });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch documents", code: "FETCH_DOCUMENTS_ERROR", statusCode: 500 });
  }
});

// PATCH /api/documents/:id/status — Update contract status
router.patch("/:id/status", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const { contractStatus } = req.body;
    const VALID = ["DRAFT", "SENT", "SIGNED", "ARCHIVED"];
    if (!contractStatus || !VALID.includes(contractStatus)) {
      return res.status(400).json({ error: `contractStatus must be one of: ${VALID.join(", ")}`, code: "INVALID_STATUS", statusCode: 400 });
    }
    const updated = await (prisma.document as any).update({
      where: { id: req.params.id },
      data: { contractStatus },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update status", code: "STATUS_UPDATE_ERROR", statusCode: 400 });
  }
});

// GET /api/documents/deal/:dealId - List documents for deal
router.get("/deal/:dealId", async (req, res) => {
  try {
    // Validate dealId format (should be UUID-like string)
    if (!req.params.dealId || req.params.dealId.length < 5) {
      return res.status(400).json({
        error: "Invalid dealId format",
        code: "INVALID_DEAL_ID",
        statusCode: 400,
      });
    }

    // Optional: verify deal exists
    const dealExists = await prisma.deal.findUnique({
      where: { id: req.params.dealId },
      select: { id: true },
    });

    if (!dealExists) {
      return res.status(404).json({
        error: "Deal not found",
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }

    const documents = await (prisma.document as any).findMany({
      where: { dealId: req.params.dealId, softDeleted: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        dealId: true,
        name: true,
        type: true,
        contractStatus: true,
        mimeType: true,
        uploadedBy: true,
        expiryDate: true,
        createdAt: true,
      },
    });

    res.json({ data: documents });
  } catch (error: any) {
    console.error("[Fetch Documents Error]", {
      dealId: req.params.dealId,
      error: error.message,
    });

    res.status(500).json({
      error: "Failed to fetch documents",
      code: "FETCH_DOCUMENTS_ERROR",
      statusCode: 500,
    });
  }
});

// GET /api/documents/:id/download - Get presigned download URL
router.get("/:id/download", async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      select: { id: true, key: true, name: true, expiryDate: true },
    });

    if (!document) {
      return res.status(404).json({
        error: "Document not found",
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }

    // Check if document has expired
    if (document.expiryDate && new Date() > new Date(document.expiryDate)) {
      return res.status(410).json({
        error: "Document has expired",
        code: "DOCUMENT_EXPIRED",
        statusCode: 410,
      });
    }

    // Generate presigned URL (1 hour expiry)
    const url = await documentService.generatePresignedUrl(document.key, 3600);

    res.json({ url, name: document.name });
  } catch (error: any) {
    console.error("[Download URL Generation Error]", {
      docId: req.params.id,
      error: error.message,
    });

    // Distinguish between different error types
    if (error.message.includes("not found")) {
      return res.status(404).json({
        error: "Document file not found in storage",
        code: "FILE_NOT_FOUND",
        statusCode: 404,
      });
    }

    res.status(500).json({
      error: "Failed to generate download URL",
      code: "DOWNLOAD_URL_ERROR",
      statusCode: 500,
    });
  }
});

// DELETE /api/documents/:id - Delete document
router.delete("/:id", async (req, res) => {
  const userId = req.auth?.userId || "unknown";

  try {
    if (!req.auth?.userId) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHENTICATED",
        statusCode: 401,
      });
    }

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      select: { id: true, key: true, name: true, dealId: true },
    });

    if (!document) {
      return res.status(404).json({
        error: "Document not found",
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }

    // Delete from S3 first (failure here shouldn't prevent DB delete)
    try {
      await documentService.deleteFile(document.key);
    } catch (s3Error: any) {
      console.warn("[S3 Delete Failed but continuing]", {
        docId: document.id,
        key: document.key,
        error: s3Error.message,
      });
      // Continue - file might already be deleted
    }

    // Delete from database
    await prisma.document.delete({ where: { id: req.params.id } });

    console.log(
      `[Document Deleted] docId=${document.id}, dealId=${document.dealId}, name=${document.name}, user=${userId}`
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Document Delete Error]", {
      docId: req.params.id,
      userId,
      error: error.message,
    });

    res.status(500).json({
      error: error.message || "Failed to delete document",
      code: "DOCUMENT_DELETE_ERROR",
      statusCode: 500,
    });
  }
});

export default router;
