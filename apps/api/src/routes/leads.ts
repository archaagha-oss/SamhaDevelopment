import { Router } from "express";
import multer from "multer";
import { validate } from "../middleware/validation";
import { createLeadSchema, updateLeadSchema, logActivitySchema } from "../schemas/validation";
import { prisma } from "../lib/prisma";
import { createLead, updateLeadStage, validateLeadTransition } from "../services/leadService";
import { createDeal as createDealService } from "../services/dealService";
import { syncContactFromSource } from "../services/contactService";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { maskLeadPii, maskLeadList, resolveCallerRole, leadAccessFilter } from "../lib/pii";
import {
  setPreferredChannel,
  setOptOut,
  getPreference,
  type Channel,
} from "../services/communicationPreferenceService";
import { normalizePhone } from "../lib/phone";
import { parseCsv, rowsToObjects } from "../lib/csv";

const router = Router();

// Every lead endpoint requires an authenticated user. Public unit shares are a
// different surface (publicShareRoutes) — leads are always staff-internal.
router.use(requireAuthentication);

// ─── List leads ──────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { stage, source, assignedAgentId, page = "1", limit = "50", search } = req.query;
    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const skip     = (pageNum - 1) * pageSize;

    const where: any = { ...(await leadAccessFilter(req)) };
    if (stage)           where.stage           = stage;
    if (source)          where.source          = source;
    if (assignedAgentId) where.assignedAgentId = assignedAgentId;

    if (search) {
      const q = (search as string).trim();
      if (q) {
        where.OR = [
          { firstName: { contains: q } },
          { lastName:  { contains: q } },
          { email:     { contains: q } },
          { phone:     { contains: q } },
        ];
      }
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: {
          assignedAgent: true,
          brokerCompany: true,
          brokerAgent:   true,
          interests:     { include: { unit: true } },
          _count:        { select: { activities: true, tasks: true } },
          deals: {
            where: { isActive: true },
            select: { id: true, stage: true, dealNumber: true, unit: { select: { unitNumber: true } } as any },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    // Attach lastContactedAt from activities
    const leadIds = leads.map((l: any) => l.id);
    const lastActivities = await prisma.activity.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _max: { activityDate: true },
    });
    const lastContactMap: Record<string, Date | null> = {};
    for (const r of lastActivities) {
      if (r.leadId) lastContactMap[r.leadId] = r._max.activityDate;
    }

    // Attach nextFollowUpDate from open tasks
    const openTasks = await prisma.task.findMany({
      where: { leadId: { in: leadIds }, completedAt: null },
      orderBy: { dueDate: "asc" },
      select: { leadId: true, dueDate: true },
    });
    const nextFollowUpMap: Record<string, Date | null> = {};
    for (const t of openTasks) {
      if (t.leadId && !nextFollowUpMap[t.leadId]) nextFollowUpMap[t.leadId] = t.dueDate;
    }

    const enriched = leads.map((l: any) => ({
      ...l,
      lastContactedAt:  lastContactMap[l.id] ?? null,
      nextFollowUpDate: nextFollowUpMap[l.id] ?? null,
    }));

    // Mask PII for VIEWER / MEMBER. ADMIN and MANAGER see full fidelity.
    const role = await resolveCallerRole(req);
    const data = maskLeadList(enriched, role);

    res.json({
      data,
      pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("[leads] GET /", error);
    res.status(500).json({ error: "Failed to fetch leads", code: "FETCH_LEADS_ERROR", statusCode: 500 });
  }
});

// ─── Get lead detail ─────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    // Single-org access scope: VIEWER / MEMBER can only see leads they're
    // assigned to. ADMIN / MANAGER see all. Using findFirst (not findUnique)
    // because findUnique can't take relational scoping in the WHERE.
    const accessScope = await leadAccessFilter(req);
    // Bound the unbounded includes — see LAUNCH_READINESS_AUDIT §3.2.
    // For older history, hit the dedicated endpoints (cursor-paginated).
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, ...accessScope },
      include: {
        assignedAgent: true,
        brokerCompany: true,
        brokerAgent:   true,
        interests:     { include: { unit: true } },
        activities:    { orderBy: { createdAt: "desc" }, take: 50 },
        tasks:         { orderBy: { dueDate: "asc" }, take: 25 },
        deals: {
          include: {
            unit: { select: { unitNumber: true, type: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        offers: {
          include: {
            unit: { select: { unitNumber: true, type: true, floor: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        documents: {
          where: { source: "GENERATED", softDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        stageHistory: { orderBy: { changedAt: "desc" }, take: 20 },
        communicationPreference: true,
      } as any,
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const role = await resolveCallerRole(req);
    res.json(maskLeadPii(lead, role));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lead", code: "FETCH_LEAD_ERROR", statusCode: 500 });
  }
});

// ─── Create lead ─────────────────────────────────────────────────────────────

router.post("/", validate(createLeadSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const lead = await createLead({ ...req.body, createdBy: req.auth.userId });
    res.status(201).json(lead);
  } catch (error: any) {
    const status = error.code === "DUPLICATE_PHONE" ? 409 : 400;
    res.status(status).json({
      error:      error.message || "Failed to create lead",
      code:       error.code    || "LEAD_CREATE_ERROR",
      statusCode: status,
      ...(error.existingId ? { existingId: error.existingId } : {}),
    });
  }
});

// ─── Bulk import leads from CSV ───────────────────────────────────────────────
// POST /api/leads/import
// multipart/form-data, field "file" — .csv, max 5 MB, capped at 1000 rows.
// Columns (case-insensitive): firstName, lastName, phone, email, source,
// assignedAgentEmail, notes. Each row is routed through the existing
// createLead service so phone normalization, duplicate-phone, and stage-history
// behaviour stay consistent with the manual create path. One bad row never
// aborts the rest.

const MAX_IMPORT_ROWS = 1000;
const REQUIRED_HEADERS = ["firstName", "lastName", "phone", "source", "assignedAgentEmail"] as const;
const OPTIONAL_HEADERS = ["email", "notes"] as const;
const VALID_SOURCES = new Set(["DIRECT", "BROKER", "WEBSITE", "REFERRAL"]);

const leadImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["text/csv", "application/vnd.ms-excel", "text/plain"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Allowed: CSV (text/csv, application/vnd.ms-excel, text/plain)"));
    }
    cb(null, true);
  },
});

interface ImportRowError {
  row: number;
  field?: string;
  message: string;
  existingId?: string;
}

/** Build a case-insensitive header → original-name map, so the CSV writer can
 *  use "FirstName" or "firstname" interchangeably with the canonical names. */
function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    map[h.toLowerCase()] = h;
  }
  return map;
}

function pick(row: Record<string, string>, headerMap: Record<string, string>, key: string): string {
  const actual = headerMap[key.toLowerCase()];
  return actual ? (row[actual] ?? "").trim() : "";
}

router.post(
  "/import",
  (req, res, next) => {
    leadImportUpload.single("file")(req, res, (err: any) => {
      if (err) {
        const isSize = err.code === "LIMIT_FILE_SIZE";
        return res.status(400).json({
          error: err.message || "File upload failed",
          code: isSize ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
          statusCode: 400,
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
      }
      if (!req.file) {
        return res.status(400).json({
          error: "No file provided. Upload a CSV under field name 'file'.",
          code: "NO_FILE",
          statusCode: 400,
        });
      }

      let parsed;
      try {
        parsed = parseCsv(req.file.buffer.toString("utf8"));
      } catch (err: any) {
        return res.status(400).json({
          error: `Malformed CSV: ${err?.message ?? "could not parse"}`,
          code: "CSV_PARSE_ERROR",
          statusCode: 400,
        });
      }

      if (parsed.header.length === 0) {
        return res.status(400).json({
          error: "CSV is empty or missing a header row",
          code: "CSV_EMPTY",
          statusCode: 400,
        });
      }

      const headerMap = buildHeaderMap(parsed.header);
      const missing = REQUIRED_HEADERS.filter((h) => !(h.toLowerCase() in headerMap));
      if (missing.length > 0) {
        return res.status(400).json({
          error: `Missing required column(s): ${missing.join(", ")}`,
          code: "CSV_MISSING_COLUMNS",
          statusCode: 400,
        });
      }

      const objects = rowsToObjects(parsed);
      if (objects.length === 0) {
        return res.json({ imported: 0, skipped: 0, errors: [] });
      }
      if (objects.length > MAX_IMPORT_ROWS) {
        return res.status(400).json({
          error: `Too many rows: ${objects.length}. Maximum ${MAX_IMPORT_ROWS} per upload.`,
          code: "CSV_TOO_MANY_ROWS",
          statusCode: 400,
        });
      }

      // Cache agent lookups so a 200-row upload assigning to two agents
      // doesn't fire 200 DB queries.
      const agentByEmail = new Map<string, { id: string } | null>();
      async function resolveAgent(email: string): Promise<{ id: string } | null> {
        const key = email.toLowerCase();
        if (agentByEmail.has(key)) return agentByEmail.get(key)!;
        const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
        agentByEmail.set(key, user ?? null);
        return user ?? null;
      }

      let imported = 0;
      let skipped = 0;
      const errors: ImportRowError[] = [];

      for (let i = 0; i < objects.length; i++) {
        // Data row 0 = file row 2 (row 1 is the header).
        const rowNum = i + 2;
        const raw = objects[i];

        const firstName          = pick(raw, headerMap, "firstName");
        const lastName           = pick(raw, headerMap, "lastName");
        const phone              = pick(raw, headerMap, "phone");
        const email              = pick(raw, headerMap, "email");
        const source             = pick(raw, headerMap, "source").toUpperCase();
        const assignedAgentEmail = pick(raw, headerMap, "assignedAgentEmail");
        const notes              = pick(raw, headerMap, "notes");

        // Skip wholly blank rows silently (Excel often appends trailing empties).
        if (!firstName && !lastName && !phone && !email && !source && !assignedAgentEmail) {
          continue;
        }

        if (!firstName) {
          skipped++;
          errors.push({ row: rowNum, field: "firstName", message: "firstName is required" });
          continue;
        }
        if (!lastName) {
          skipped++;
          errors.push({ row: rowNum, field: "lastName", message: "lastName is required" });
          continue;
        }
        if (!phone) {
          skipped++;
          errors.push({ row: rowNum, field: "phone", message: "phone is required" });
          continue;
        }
        if (!source) {
          skipped++;
          errors.push({ row: rowNum, field: "source", message: "source is required" });
          continue;
        }
        if (!VALID_SOURCES.has(source)) {
          skipped++;
          errors.push({ row: rowNum, field: "source", message: `Unknown source "${source}". Allowed: DIRECT, BROKER, WEBSITE, REFERRAL` });
          continue;
        }
        if (!assignedAgentEmail) {
          skipped++;
          errors.push({ row: rowNum, field: "assignedAgentEmail", message: "assignedAgentEmail is required" });
          continue;
        }

        const agent = await resolveAgent(assignedAgentEmail);
        if (!agent) {
          skipped++;
          errors.push({ row: rowNum, field: "assignedAgentEmail", message: `Agent not found: ${assignedAgentEmail}` });
          continue;
        }

        try {
          await createLead({
            firstName,
            lastName,
            phone,
            email: email || undefined,
            source,
            assignedAgentId: agent.id,
            notes: notes || undefined,
            createdBy: req.auth.userId,
          });
          imported++;
        } catch (err: any) {
          skipped++;
          const message: string = err?.message || "Failed to create lead";
          const field =
            err?.code === "DUPLICATE_PHONE" || err?.code === "INVALID_PHONE" ? "phone" : undefined;
          const entry: ImportRowError = { row: rowNum, message };
          if (field) entry.field = field;
          if (err?.existingId) entry.existingId = err.existingId;
          errors.push(entry);
        }
      }

      res.json({ imported, skipped, errors });
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || "Lead import failed",
        code: "LEAD_IMPORT_ERROR",
        statusCode: 500,
      });
    }
  }
);

// ─── Update lead stage (state machine enforced) ───────────────────────────────

router.patch("/:id/stage", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { newStage, reason } = req.body;
    if (!newStage) {
      return res.status(400).json({ error: "newStage is required", code: "MISSING_FIELD", statusCode: 400 });
    }

    await updateLeadStage(req.params.id, newStage, req.auth.userId, reason);
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { assignedAgent: true, brokerCompany: true, interests: { include: { unit: true } } },
    });
    res.json(lead);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update stage", code: "LEAD_STAGE_ERROR", statusCode: 400 });
  }
});

// ─── Communication preference (channel learning) ────────────────────────────

router.get("/:id/communication-preference", async (req, res) => {
  try {
    const pref = await getPreference({ leadId: req.params.id });
    res.json(pref ?? null);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch preference", code: "PREFERENCE_FETCH_ERROR", statusCode: 500 });
  }
});

router.patch("/:id/communication-preference", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { preferredChannel, emailOptOut, whatsappOptOut, smsOptOut } = req.body;
    const validChannels = ["EMAIL", "WHATSAPP", "SMS"];

    if (preferredChannel !== undefined) {
      if (preferredChannel !== null && !validChannels.includes(preferredChannel)) {
        return res.status(400).json({ error: "preferredChannel must be EMAIL, WHATSAPP, SMS, or null", code: "INVALID_CHANNEL", statusCode: 400 });
      }
      await setPreferredChannel({ leadId: req.params.id, channel: preferredChannel as Channel | null });
    }
    if (typeof emailOptOut    === "boolean") await setOptOut({ leadId: req.params.id, channel: "EMAIL",    optOut: emailOptOut });
    if (typeof whatsappOptOut === "boolean") await setOptOut({ leadId: req.params.id, channel: "WHATSAPP", optOut: whatsappOptOut });
    if (typeof smsOptOut      === "boolean") await setOptOut({ leadId: req.params.id, channel: "SMS",      optOut: smsOptOut });

    const updated = await getPreference({ leadId: req.params.id });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update preference", code: "PREFERENCE_UPDATE_ERROR", statusCode: 500 });
  }
});

// ─── Get valid next stages ────────────────────────────────────────────────────

router.get("/:id/valid-transitions", async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      select: { stage: true },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const ALL_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "PROPOSAL", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST"];
    const validNext = ALL_STAGES.filter((s) => validateLeadTransition(lead.stage as any, s as any).valid);
    res.json({ current: lead.stage, validNext });
  } catch (error) {
    res.status(500).json({ error: "Failed to get transitions", code: "TRANSITIONS_ERROR", statusCode: 500 });
  }
});

// ─── Get stage history ────────────────────────────────────────────────────────

router.get("/:id/stage-history", async (req, res) => {
  try {
    const history = await prisma.leadStageHistory.findMany({
      where: { leadId: req.params.id },
      orderBy: { changedAt: "desc" },
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stage history", code: "FETCH_HISTORY_ERROR", statusCode: 500 });
  }
});

// ─── Add unit interest ────────────────────────────────────────────────────────

router.post("/:id/interests", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { unitId, isPrimary } = req.body;

    const [interest, unit] = await Promise.all([
      prisma.leadUnitInterest.create({
        data: { leadId: req.params.id, unitId, isPrimary: isPrimary || false },
      }),
      prisma.unit.findUnique({ where: { id: unitId }, select: { price: true } }),
    ]);

    // Auto-create an active offer for this unit interest
    const existingOffer = await prisma.offer.findFirst({
      where: { leadId: req.params.id, unitId, status: "ACTIVE" },
    });
    if (!existingOffer && unit) {
      await prisma.offer.create({
        data: {
          leadId:        req.params.id,
          unitId,
          offeredPrice:  unit.price,
          originalPrice: unit.price,
          discountAmount: 0,
          discountPct:    0,
          status:        "ACTIVE",
          createdBy:     req.auth.userId,
        },
      });
    }

    res.status(201).json(interest);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to add interest", code: "INTEREST_ADD_ERROR", statusCode: 400 });
  }
});

// ─── Remove unit interest ─────────────────────────────────────────────────────

router.delete("/:id/interests/:unitId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    await prisma.leadUnitInterest.delete({
      where: { leadId_unitId: { leadId: req.params.id, unitId: req.params.unitId } },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove interest", code: "INTEREST_REMOVE_ERROR", statusCode: 500 });
  }
});

// ─── Log activity ─────────────────────────────────────────────────────────────

router.post("/:leadId/activities", validate(logActivitySchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { type, summary, outcome, callDuration, followUpDate } = req.body;

    const activity = await prisma.activity.create({
      data: {
        leadId:       req.params.leadId,
        type,
        summary,
        outcome,
        callDuration,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        createdBy:    req.auth.userId,
      },
    });

    if (followUpDate) {
      const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId }, select: { assignedAgentId: true } });
      await prisma.task.create({
        data: {
          leadId:      req.params.leadId,
          title:       `Follow up: ${summary.slice(0, 80)}`,
          type:        "FOLLOW_UP",
          priority:    "MEDIUM",
          status:      "PENDING",
          dueDate:     new Date(followUpDate),
          assignedToId: lead?.assignedAgentId ?? null,
        },
      });
    }

    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ error: "Failed to log activity", code: "ACTIVITY_LOG_ERROR", statusCode: 500 });
  }
});

// ─── Get activities ───────────────────────────────────────────────────────────

router.get("/:leadId/activities", async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { leadId: req.params.leadId },
      orderBy: { createdAt: "desc" },
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activities", code: "FETCH_ACTIVITIES_ERROR", statusCode: 500 });
  }
});

// ─── Update lead fields ───────────────────────────────────────────────────────
// Note: stage changes must go through PATCH /:id/stage (enforces state machine).
// If stage is included here it is silently ignored.

router.patch("/:id", validate(updateLeadSchema), async (req, res) => {
  try {
    const {
      firstName, lastName, phone, email, nationality,
      source, budget, assignedAgentId, notes,
      brokerCompanyId, brokerAgentId,
      // SPA / KYC fields
      address, emiratesId, passportNumber, companyRegistrationNumber,
      authorizedSignatory, sourceOfFunds,
      // KYC / AML profile fields (per-person)
      dateOfBirth, pepFlag, riskRating, occupation, residencyStatus,
      // Arabic legal names (Phase 4a) — surfaced in the bilingual SPA.
      firstNameAr, lastNameAr,
      // stage is intentionally excluded — use PATCH /:id/stage
    } = req.body;

    // Normalize phone to E.164 before the uniqueness check + write, so a
    // raw-digit and a formatted variant of the same number collide rather
    // than silently coexisting.
    let normalizedPhone: string | undefined;
    if (phone !== undefined) {
      const e164 = normalizePhone(phone);
      if (!e164) {
        return res.status(400).json({ error: "Invalid phone number", code: "INVALID_PHONE", statusCode: 400 });
      }
      normalizedPhone = e164;

      const existing = await prisma.lead.findFirst({
        where: { phone: normalizedPhone, NOT: { id: req.params.id } },
      });
      if (existing) {
        return res.status(409).json({ error: "Phone already in use by another lead", code: "DUPLICATE_PHONE", statusCode: 409, existingId: existing.id });
      }
    }

    const data: any = {};
    if (firstName        !== undefined) data.firstName        = firstName;
    if (lastName         !== undefined) data.lastName         = lastName;
    if (normalizedPhone  !== undefined) data.phone            = normalizedPhone;
    if (email            !== undefined) data.email            = email || null;
    if (nationality      !== undefined) data.nationality      = nationality || null;
    if (source           !== undefined) data.source           = source;
    if (budget           !== undefined) data.budget           = budget ? parseFloat(budget) : null;
    if (assignedAgentId  !== undefined) data.assignedAgentId  = assignedAgentId;
    if (notes            !== undefined) data.notes            = notes || null;
    if (brokerCompanyId  !== undefined) data.brokerCompanyId  = brokerCompanyId || null;
    if (brokerAgentId    !== undefined) data.brokerAgentId    = brokerAgentId   || null;
    if (address                   !== undefined) data.address                   = address || null;
    if (emiratesId                !== undefined) data.emiratesId                = emiratesId || null;
    if (passportNumber            !== undefined) data.passportNumber            = passportNumber || null;
    if (companyRegistrationNumber !== undefined) data.companyRegistrationNumber = companyRegistrationNumber || null;
    if (authorizedSignatory       !== undefined) data.authorizedSignatory       = authorizedSignatory || null;
    if (sourceOfFunds             !== undefined) data.sourceOfFunds             = sourceOfFunds || null;
    if (dateOfBirth     !== undefined) data.dateOfBirth     = dateOfBirth ? new Date(dateOfBirth) : null;
    if (pepFlag         !== undefined) data.pepFlag         = !!pepFlag;
    if (riskRating      !== undefined) data.riskRating      = riskRating || null;
    if (occupation      !== undefined) data.occupation      = occupation || null;
    if (residencyStatus !== undefined) data.residencyStatus = residencyStatus || null;
    if (firstNameAr     !== undefined) data.firstNameAr     = firstNameAr || null;
    if (lastNameAr      !== undefined) data.lastNameAr      = lastNameAr  || null;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data,
      include: {
        assignedAgent: true,
        brokerCompany: true,
        brokerAgent:   true,
        interests:     { include: { unit: true } },
      },
    });

    await syncContactFromSource({
      ref: { kind: "lead", id: lead.id },
      firstName:   lead.firstName,
      lastName:    lead.lastName,
      email:       lead.email,
      phone:       lead.phone,
      nationality: lead.nationality,
      company:     lead.brokerCompany?.name ?? null,
      notes:       lead.notes,
    });

    res.json(lead);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update lead", code: "LEAD_UPDATE_ERROR", statusCode: 400 });
  }
});

// ─── Convert lead to deal in one action ──────────────────────────────────────
// Body: { unitId?: string, notes?: string }
// Auto-fills: contact (leadId), agent, broker from lead.
// If unitId omitted, falls back to lead's primary unit interest.
// Sets lead stage → NEGOTIATING and logs audit activity.

router.post("/:id/create-deal", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        interests: {
          include: { unit: true },
          orderBy: { isPrimary: "desc" },
        },
      },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
    }

    // Block already-closed leads
    if (["CLOSED_WON", "CLOSED_LOST"].includes(lead.stage)) {
      return res.status(400).json({
        error: `Cannot create a deal for a lead that is ${lead.stage.replace(/_/g, " ").toLowerCase()}.`,
        code: "LEAD_ALREADY_CLOSED",
        statusCode: 400,
      });
    }

    // Block if an active deal already exists
    const existingDeal = await prisma.deal.findFirst({
      where: { leadId: lead.id, isActive: true },
      select: { id: true, dealNumber: true },
    });
    if (existingDeal) {
      return res.status(409).json({
        error: `Active deal already exists for this lead: ${existingDeal.dealNumber}`,
        code: "DEAL_ALREADY_EXISTS",
        existingDealId: existingDeal.id,
        statusCode: 409,
      });
    }

    // Resolve unit: prefer explicitly supplied unitId, then primary interest, then first interest
    const { unitId: requestedUnitId, notes } = req.body;

    let resolvedUnit: any = null;

    if (requestedUnitId) {
      const unit = await prisma.unit.findUnique({ where: { id: requestedUnitId } });
      if (!unit) {
        return res.status(404).json({ error: "Unit not found", code: "UNIT_NOT_FOUND", statusCode: 404 });
      }
      if (!["AVAILABLE", "ON_HOLD"].includes(unit.status)) {
        return res.status(400).json({
          error: `Unit ${unit.unitNumber} is ${unit.status} and cannot be reserved.`,
          code: "UNIT_NOT_AVAILABLE",
          statusCode: 400,
        });
      }
      resolvedUnit = unit;
    } else {
      const interest =
        lead.interests.find((i) => i.isPrimary && ["AVAILABLE", "ON_HOLD"].includes((i.unit as any).status)) ??
        lead.interests.find((i) => ["AVAILABLE", "ON_HOLD"].includes((i.unit as any).status));

      if (!interest) {
        return res.status(400).json({
          error: "No available unit selected. Please choose a unit or add an interested unit to the lead first.",
          code: "NO_AVAILABLE_UNIT",
          statusCode: 400,
        });
      }
      resolvedUnit = interest.unit;
    }

    // Use first active payment plan as default
    const paymentPlan = await prisma.paymentPlan.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!paymentPlan) {
      return res.status(400).json({
        error: "No active payment plan found. Create a payment plan first.",
        code: "NO_PAYMENT_PLAN",
        statusCode: 400,
      });
    }

    const deal = await createDealService({
      leadId:          lead.id,
      unitId:          resolvedUnit.id,
      salePrice:       resolvedUnit.price,
      createdBy:       req.auth.userId,
      paymentPlanId:   paymentPlan.id,
      brokerCompanyId: lead.brokerCompanyId ?? undefined,
      brokerAgentId:   lead.brokerAgentId   ?? undefined,
    });

    // If notes provided, save them on the deal
    if (notes?.trim()) {
      await prisma.deal.update({ where: { id: deal.id }, data: { notes: notes.trim() } });
    }

    // Advance lead to NEGOTIATING if not already past that stage
    const NEGOTIATING_ALLOWED_FROM = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "PROPOSAL"];
    if (NEGOTIATING_ALLOWED_FROM.includes(lead.stage)) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: "NEGOTIATING" } });
      await prisma.leadStageHistory.create({
        data: {
          leadId:    lead.id,
          oldStage:  lead.stage as any,
          newStage:  "NEGOTIATING",
          changedBy: req.auth.userId,
          reason:    `Deal ${deal.dealNumber} created`,
        },
      });
    }

    // Audit log
    await prisma.activity.create({
      data: {
        leadId:    lead.id,
        dealId:    deal.id,
        type:      "NOTE",
        summary:   `Deal created from lead — Unit ${resolvedUnit.unitNumber}`,
        createdBy: req.auth.userId,
      },
    });

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(400).json({
      error:      error.message || "Failed to create deal",
      code:       "DEAL_CREATE_ERROR",
      statusCode: 400,
    });
  }
});

// ─── Delete lead ──────────────────────────────────────────────────────────────

router.delete("/:id", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { deals: { where: { isActive: true } } },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (lead.deals.length > 0) {
      return res.status(400).json({
        error: "Cannot delete lead with active deals. Cancel or complete deals first.",
        code: "LEAD_HAS_DEALS",
        statusCode: 400,
      });
    }

    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete lead", code: "LEAD_DELETE_ERROR", statusCode: 400 });
  }
});

export default router;
