import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuthentication, requireRole } from "../middleware/auth";

const router = Router();

// Contacts are an internal CRM directory — every endpoint requires auth.
router.use(requireAuthentication);

// ─── List contacts ────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { search, source, tags, page = "1", limit = "50" } = req.query;
    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const skip     = (pageNum - 1) * pageSize;

    const org = await prisma.organization.findFirst();
    if (!org) return res.status(404).json({ error: "Organization not found", code: "NOT_FOUND", statusCode: 404 });

    const where: any = { organizationId: org.id };
    if (source) where.source = source;
    if (tags)   where.tags   = { contains: tags as string };

    if (search) {
      const q = (search as string).trim();
      if (q) {
        where.OR = [
          { firstName: { contains: q } },
          { lastName:  { contains: q } },
          { email:     { contains: q } },
          { phone:     { contains: q } },
          { company:   { contains: q } },
        ];
      }
    }

    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        include: {
          _count: { select: { activities: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    res.json({ data: contacts, total, page: pageNum, pageSize });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Get single contact ───────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        activities: { orderBy: { activityDate: "desc" }, take: 20 },
      },
    });
    if (!contact) return res.status(404).json({ error: "Contact not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Create contact ───────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) return res.status(404).json({ error: "Organization not found", code: "NOT_FOUND", statusCode: 404 });

    const {
      firstName, lastName, email, phone, whatsapp,
      company, jobTitle, nationality, source, notes, tags,
    } = req.body;

    if (!firstName) {
      return res.status(400).json({ error: "firstName is required", code: "VALIDATION_ERROR", statusCode: 400 });
    }

    const contact = await prisma.contact.create({
      data: {
        organizationId: org.id,
        firstName,
        lastName,
        email,
        phone,
        whatsapp,
        company,
        jobTitle,
        nationality,
        source: source ?? "MANUAL",
        notes,
        tags,
      },
    });

    res.status(201).json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Update contact ───────────────────────────────────────────────────────────

router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Contact not found", code: "NOT_FOUND", statusCode: 404 });

    const {
      firstName, lastName, email, phone, whatsapp,
      company, jobTitle, nationality, source, notes, tags,
    } = req.body;

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        ...(firstName   !== undefined && { firstName }),
        ...(lastName    !== undefined && { lastName }),
        ...(email       !== undefined && { email }),
        ...(phone       !== undefined && { phone }),
        ...(whatsapp    !== undefined && { whatsapp }),
        ...(company     !== undefined && { company }),
        ...(jobTitle    !== undefined && { jobTitle }),
        ...(nationality !== undefined && { nationality }),
        ...(source      !== undefined && { source }),
        ...(notes       !== undefined && { notes }),
        ...(tags        !== undefined && { tags }),
      },
    });

    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

// ─── Delete contact ───────────────────────────────────────────────────────────

router.delete("/:id", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Contact not found", code: "NOT_FOUND", statusCode: 404 });

    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR", statusCode: 500 });
  }
});

export default router;
