import { PrismaClient, UserRole, ViewType } from "@prisma/client";

const prisma = new PrismaClient();

const SAMHA_TOWER = {
  name: "Samha Tower",
  location: "Dubai Marina",
  totalUnits: 175,
  handoverDate: new Date("2026-12-31"),
};

// Ground floor retail units
const GROUND_UNITS = [
  { unitNumber: "RETAIL-1", totalSqm: 203.62, internalSqm: 203.62, externalSqm: 0, parking: 0 },
  { unitNumber: "RETAIL-2", totalSqm:  51.14, internalSqm:  51.14, externalSqm: 0, parking: 0 },
];

// Floor 1: 9 units (larger suites, unique layout)
const FLOOR1_LAYOUT = [
  { suffix:"01", rooms:26, totalSqm:50.36,  internalSqm:41.09, externalSqm: 9.27, parking:1 },
  { suffix:"02", rooms: 1, totalSqm:96.61,  internalSqm:71.63, externalSqm:24.98, parking:1 },
  { suffix:"03", rooms: 1, totalSqm:78.43,  internalSqm:62.29, externalSqm:16.14, parking:1 },
  { suffix:"04", rooms:26, totalSqm:42.05,  internalSqm:32.19, externalSqm: 9.86, parking:1 },
  { suffix:"05", rooms: 1, totalSqm:71.23,  internalSqm:55.37, externalSqm:15.86, parking:1 },
  { suffix:"06", rooms: 1, totalSqm:71.23,  internalSqm:55.37, externalSqm:15.86, parking:1 },
  { suffix:"07", rooms:26, totalSqm:42.05,  internalSqm:32.19, externalSqm: 9.86, parking:1 },
  { suffix:"08", rooms: 1, totalSqm:78.88,  internalSqm:62.71, externalSqm:16.17, parking:1 },
  { suffix:"09", rooms: 1, totalSqm:81.34,  internalSqm:72.19, externalSqm: 9.15, parking:1 },
];

// Floors 2–13: 10 units each (standard layout, identical areas)
const STANDARD_LAYOUT = [
  { suffix:"01", rooms: 1, totalSqm:77.09, internalSqm:69.53, externalSqm: 7.56, parking:1 },
  { suffix:"02", rooms: 1, totalSqm:80.52, internalSqm:71.63, externalSqm: 8.89, parking:1 },
  { suffix:"03", rooms: 1, totalSqm:73.43, internalSqm:62.29, externalSqm:11.14, parking:1 },
  { suffix:"04", rooms:26, totalSqm:39.48, internalSqm:32.19, externalSqm: 7.29, parking:1 },
  { suffix:"05", rooms: 1, totalSqm:63.59, internalSqm:55.37, externalSqm: 8.22, parking:1 },
  { suffix:"06", rooms: 1, totalSqm:63.59, internalSqm:55.37, externalSqm: 8.22, parking:1 },
  { suffix:"07", rooms:26, totalSqm:39.48, internalSqm:32.19, externalSqm: 7.29, parking:1 },
  { suffix:"08", rooms: 1, totalSqm:73.87, internalSqm:62.71, externalSqm:11.16, parking:1 },
  { suffix:"09", rooms: 1, totalSqm:81.34, internalSqm:72.19, externalSqm: 9.15, parking:1 },
  { suffix:"10", rooms: 1, totalSqm:77.26, internalSqm:69.70, externalSqm: 7.56, parking:1 },
];

// Floors 14–18: 8 units each (2BR introduced at 03 & 06)
const HIGH_FLOOR_LAYOUT = [
  { suffix:"01", rooms:1, totalSqm: 77.09, internalSqm:69.53, externalSqm: 7.56, parking:1 },
  { suffix:"02", rooms:1, totalSqm: 80.52, internalSqm:71.63, externalSqm: 8.89, parking:1 },
  { suffix:"03", rooms:2, totalSqm:114.00, internalSqm:95.74, externalSqm:18.26, parking:1 },
  { suffix:"04", rooms:1, totalSqm: 63.59, internalSqm:55.37, externalSqm: 8.22, parking:1 },
  { suffix:"05", rooms:1, totalSqm: 63.59, internalSqm:55.37, externalSqm: 8.22, parking:1 },
  { suffix:"06", rooms:2, totalSqm:114.39, internalSqm:96.11, externalSqm:18.28, parking:1 },
  { suffix:"07", rooms:1, totalSqm: 81.34, internalSqm:72.19, externalSqm: 9.15, parking:1 },
  { suffix:"08", rooms:1, totalSqm: 77.26, internalSqm:69.70, externalSqm: 7.56, parking:1 },
];

// Floor 19: 4 penthouse units
const PENTHOUSE_LAYOUT = [
  { suffix:"01", rooms:2, totalSqm:164.43, internalSqm: 92.83, externalSqm: 71.60, parking:1 },
  { suffix:"02", rooms:1, totalSqm:182.05, internalSqm: 79.43, externalSqm:102.62, parking:1 },
  { suffix:"03", rooms:1, totalSqm:181.68, internalSqm: 79.43, externalSqm:102.25, parking:1 },
  { suffix:"04", rooms:2, totalSqm:163.19, internalSqm: 92.42, externalSqm: 70.77, parking:1 },
];

// Status distribution (weighted)
const STATUS_DISTRIBUTION = {
  AVAILABLE: 0.6,
  SOLD: 0.18,
  RESERVED: 0.1,
  BOOKED: 0.07,
  BLOCKED: 0.05,
};

const USERS: Array<{ name: string; email: string; role: UserRole; clerkId: string }> = [
  {
    name: "Mohamed Admin",
    email: "admin@samha.ae",
    role: "ADMIN" as UserRole,
    clerkId: "admin_001",
  },
  {
    name: "Sara Sales",
    email: "sara@samha.ae",
    role: "SALES_AGENT" as UserRole,
    clerkId: "sales_001",
  },
  {
    name: "Khalid Sales",
    email: "khalid@samha.ae",
    role: "SALES_AGENT" as UserRole,
    clerkId: "sales_002",
  },
  {
    name: "Fatima Operations",
    email: "fatima@samha.ae",
    role: "OPERATIONS" as UserRole,
    clerkId: "ops_001",
  },
  {
    name: "Omar Finance",
    email: "omar@samha.ae",
    role: "FINANCE" as UserRole,
    clerkId: "finance_001",
  },
];

function getRandomStatus(): string {
  const rand = Math.random();
  let cumulative = 0;

  for (const [status, weight] of Object.entries(STATUS_DISTRIBUTION)) {
    cumulative += weight;
    if (rand <= cumulative) return status;
  }

  return "AVAILABLE";
}

function getUnitType(rooms: number | null): string {
  if (rooms === null) return "COMMERCIAL";
  if (rooms === 26) return "STUDIO";
  if (rooms === 1) return "ONE_BR";
  if (rooms === 2) return "TWO_BR";
  return "ONE_BR";
}

// View assigned by unit position within floor (suffix = "01"–"10")
const SUFFIX_VIEW: Record<string, ViewType> = {
  "01": "SEA"       as ViewType,
  "02": "SEA"       as ViewType,
  "03": "STREET"    as ViewType,
  "04": "BACK"      as ViewType,
  "05": "AMENITIES" as ViewType,
  "06": "AMENITIES" as ViewType,
  "07": "BACK"      as ViewType,
  "08": "STREET"    as ViewType,
  "09": "SEA"       as ViewType,
  "10": "SEA"       as ViewType,
};

function getView(suffix: string, floor: number): ViewType {
  if (floor === 0) return "BACK" as ViewType;
  if (floor === 19) return "SEA" as ViewType;
  return SUFFIX_VIEW[suffix] ?? ("STREET" as ViewType);
}

// Price = sqm × base rate (AED/sqm) × floor premium (0.5% per floor above ground)
function computePrice(type: string, totalSqm: number, floor: number): number {
  const baseRate: Record<string, number> = {
    COMMERCIAL: 30000,
    STUDIO:     18000,
    ONE_BR:     15000,
    TWO_BR:     14000,
  };
  const rate = baseRate[type] ?? 15000;
  const floorPremium = 1 + Math.max(0, floor - 1) * 0.005;
  return Math.round(rate * totalSqm * floorPremium / 1000) * 1000;
}

async function seed() {
  console.log("🌱 Seeding database...");

  // Clear existing data (respecting foreign key constraints)
  console.log("Clearing existing data...");
  await prisma.paymentAuditLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.commission.deleteMany({});
  await prisma.dealStageHistory.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.paymentPlanMilestone.deleteMany({});
  await prisma.paymentPlan.deleteMany({});
  await prisma.leadStageHistory.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.leadUnitInterest.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.brokerAgent.deleteMany({});
  await prisma.brokerCompany.deleteMany({});
  await prisma.unitStatusHistory.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});

  // Create project
  console.log("Creating project...");
  const project = await prisma.project.create({
    data: SAMHA_TOWER,
  });
  console.log(`✓ Project created: ${project.name}`);

  // Create users
  console.log("Creating users...");
  const users = await Promise.all(
    USERS.map((user) => prisma.user.create({ data: user }))
  );
  console.log(`✓ ${users.length} users created`);

  // Create units from actual building layout
  console.log("Creating 175 units...");
  const units: any[] = [];
  const agentIds = [users[1].id, users[2].id];

  async function createUnit(
    unitNumber: string,
    floor: number,
    rooms: number | null,
    totalSqm: number,
    suffix: string,
    internalSqm?: number,
    externalSqm?: number,
    parking?: number
  ) {
    const type = getUnitType(rooms);
    const price = computePrice(type, totalSqm, floor);
    const view = getView(suffix, floor);
    const unit = await prisma.unit.create({
      data: {
        projectId: project.id,
        unitNumber,
        floor,
        type: type as any,
        area: totalSqm,
        basePrice: price,
        price,
        view,
        status: getRandomStatus() as any,
        assignedAgentId: agentIds[Math.floor(Math.random() * agentIds.length)],
        internalArea: internalSqm ?? null,
        externalArea: externalSqm ?? null,
        parkingSpaces: parking ?? null,
      },
    });
    units.push(unit);
    return unit;
  }

  // Ground floor retail
  for (const retail of GROUND_UNITS) {
    await createUnit(retail.unitNumber, 0, null, retail.totalSqm, "00", retail.internalSqm, retail.externalSqm, retail.parking);
  }

  // Floor 1 (9 units, unique layout)
  for (const u of FLOOR1_LAYOUT) {
    await createUnit(`1${u.suffix}`, 1, u.rooms, u.totalSqm, u.suffix, u.internalSqm, u.externalSqm, u.parking);
  }

  // Floors 2–13 (10 units each, standard layout)
  for (let floor = 2; floor <= 13; floor++) {
    for (const u of STANDARD_LAYOUT) {
      await createUnit(`${floor}${u.suffix}`, floor, u.rooms, u.totalSqm, u.suffix, u.internalSqm, u.externalSqm, u.parking);
    }
    if (floor % 4 === 0) console.log(`  Floors 2–${floor} created...`);
  }

  // Floors 14–18 (8 units each, 2BR introduced)
  for (let floor = 14; floor <= 18; floor++) {
    for (const u of HIGH_FLOOR_LAYOUT) {
      await createUnit(`${floor}${u.suffix}`, floor, u.rooms, u.totalSqm, u.suffix, u.internalSqm, u.externalSqm, u.parking);
    }
  }

  // Floor 19 penthouses (4 units)
  for (const u of PENTHOUSE_LAYOUT) {
    await createUnit(`19${u.suffix}`, 19, u.rooms, u.totalSqm, u.suffix, u.internalSqm, u.externalSqm, u.parking);
  }

  console.log(`✓ ${units.length} units created`);

  // Create sample status history
  console.log("Creating status history records...");
  const historyCount = Math.floor(units.length * 0.3);
  for (let i = 0; i < historyCount; i++) {
    const unit = units[Math.floor(Math.random() * units.length)];
    const statuses = Object.values(
      "AVAILABLE RESERVED BOOKED SOLD BLOCKED HANDED_OVER NOT_RELEASED".split(" ")
    );

    await prisma.unitStatusHistory.create({
      data: {
        unitId: unit.id,
        oldStatus: statuses[Math.floor(Math.random() * statuses.length)] as any,
        newStatus: unit.status as any,
        changedBy: users[0].email,
        reason: "Initial seeding",
        changedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
      },
    });
  }
  console.log(`✓ ${historyCount} status history records created`);

  // Phase 3: Create payment plans
  console.log("Creating payment plans...");
  const paymentPlans = await Promise.all([
    prisma.paymentPlan.create({
      data: {
        name: "Standard 50-30-20",
        description: "50% on booking, 30% on SPA signing, 20% on handover",
        isActive: true,
        milestones: {
          create: [
            {
              label: "Booking Deposit",
              percentage: 50,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 0,
              sortOrder: 1,
            },
            {
              label: "DLD Fee",
              percentage: 0,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 0,
              isDLDFee: true,
              sortOrder: 2,
            },
            {
              label: "Admin Fee",
              percentage: 0,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 0,
              isAdminFee: true,
              sortOrder: 3,
            },
            {
              label: "SPA Signing",
              percentage: 30,
              triggerType: "ON_SPA_SIGNING",
              sortOrder: 4,
            },
            {
              label: "Handover",
              percentage: 20,
              triggerType: "ON_HANDOVER",
              sortOrder: 5,
            },
          ],
        },
      },
    }),
    prisma.paymentPlan.create({
      data: {
        name: "Construction Linked",
        description: "Payments tied to construction stages",
        isActive: true,
        milestones: {
          create: [
            {
              label: "Booking",
              percentage: 25,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 0,
              sortOrder: 1,
            },
            {
              label: "Foundation (30%)",
              percentage: 20,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 180,
              sortOrder: 2,
            },
            {
              label: "Superstructure (60%)",
              percentage: 25,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 365,
              sortOrder: 3,
            },
            {
              label: "Finishing (90%)",
              percentage: 20,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 540,
              sortOrder: 4,
            },
            {
              label: "Handover",
              percentage: 10,
              triggerType: "ON_HANDOVER",
              sortOrder: 5,
            },
          ],
        },
      },
    }),
  ]);
  console.log(`✓ ${paymentPlans.length} payment plans created`);

  // Phase 2: Create sample leads
  console.log("Creating sample leads...");
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        firstName: "Ahmed",
        lastName: "Al-Maktoum",
        phone: "+971501234567",
        email: "ahmed@example.com",
        nationality: "UAE",
        source: "DIRECT",
        budget: 2500000,
        assignedAgentId: users[1].id,
        stage: "NEGOTIATING",
      },
    }),
    prisma.lead.create({
      data: {
        firstName: "Fatima",
        lastName: "Al-Mansoori",
        phone: "+971502345678",
        email: "fatima@example.com",
        nationality: "UAE",
        source: "BROKER",
        budget: 1800000,
        assignedAgentId: users[2].id,
        stage: "OFFER_SENT",
      },
    }),
    prisma.lead.create({
      data: {
        firstName: "John",
        lastName: "Smith",
        phone: "+971503456789",
        email: "john@example.com",
        nationality: "UK",
        source: "WEBSITE",
        budget: 2200000,
        assignedAgentId: users[1].id,
        stage: "SITE_VISIT",
      },
    }),
  ]);
  console.log(`✓ ${leads.length} sample leads created`);

  // Phase 3: Create sample deals
  console.log("Creating sample deals...");
  const soldUnits = units.filter((u) => u.status === "SOLD").slice(0, 3);
  const deals = await Promise.all(
    leads.slice(0, soldUnits.length).map((lead, index) => {
      const unit = soldUnits[index];
      const reservationDate = new Date();
      reservationDate.setDate(reservationDate.getDate() - Math.floor(Math.random() * 30));

      return prisma.deal.create({
        data: {
          dealNumber: `DEAL-2026-${String(1000 + index).slice(-4)}`,
          leadId: lead.id,
          unitId: unit.id,
          stage: index === 0 ? "SPA_SIGNED" : "RESERVATION_CONFIRMED",
          salePrice: unit.price * (1 - Math.random() * 0.1), // 0-10% discount
          discount: unit.price * Math.random() * 0.1,
          dldFee: unit.price * 0.04,
          adminFee: 5000,
          paymentPlanId: paymentPlans[0].id,
          reservationDate,
          oqoodDeadline: new Date(reservationDate.getTime() + 90 * 24 * 60 * 60 * 1000),
          spaSignedDate: index === 0 ? new Date(reservationDate.getTime() + 15 * 24 * 60 * 60 * 1000) : null,
        },
      });
    })
  );
  console.log(`✓ ${deals.length} sample deals created`);

  // Phase 3: Create payment milestones for first deal
  if (deals.length > 0) {
    console.log("Creating payment milestones...");
    const firstDeal = deals[0];

    // Get the payment plan with milestones
    const plan = await prisma.paymentPlan.findUnique({
      where: { id: paymentPlans[0].id },
      include: { milestones: true },
    });

    if (plan && plan.milestones) {
      const payments = await Promise.all(
        plan.milestones.map((milestone, index) => {
          const dueDate = new Date(firstDeal.reservationDate);
          dueDate.setDate(dueDate.getDate() + (index + 1) * 30);

          const amount = (milestone.percentage / 100) * firstDeal.salePrice;
          return prisma.payment.create({
            data: {
              dealId: firstDeal.id,
              milestoneLabel: milestone.label,
              amount,
              originalAmount: amount,
              percentage: milestone.percentage,
              dueDate,
              status: index === 0 ? "PAID" : "PENDING",
              paidDate: index === 0 ? firstDeal.reservationDate : null,
              paidBy: index === 0 ? users[1].email : null,
            },
          });
        })
      );
      console.log(`✓ ${payments.length} payment milestones created for first deal`);
    }

    // Create commission for first deal
    console.log("Creating commission record...");
    await prisma.commission.create({
      data: {
        dealId: firstDeal.id,
        amount: firstDeal.salePrice * 0.03,
        rate: 3,
        status: firstDeal.stage === "SPA_SIGNED" ? "APPROVED" : "PENDING_APPROVAL",
        spaSignedMet: firstDeal.stage === "SPA_SIGNED",
      },
    });
    console.log(`✓ Commission record created`);
  }

  // Phase 4: Create broker companies and agents
  console.log("Creating broker companies...");
  const brokerCompanies = await Promise.all([
    prisma.brokerCompany.create({
      data: {
        name: "Dubai Premium Properties",
        email: "info@dubaipremium.ae",
        phone: "+971-4-XXX-XXXX",
        agents: {
          create: [
            {
              name: "Khalid Al Mansouri",
              email: "khalid@dubaipremium.ae",
              phone: "+971-50-111-2222",
            },
            {
              name: "Fatima Al Ketbi",
              email: "fatima@dubaipremium.ae",
              phone: "+971-50-111-3333",
            },
          ],
        },
      },
      include: { agents: true },
    }),
    prisma.brokerCompany.create({
      data: {
        name: "Al Waha Real Estate",
        email: "contact@alwaha.ae",
        phone: "+971-4-XXX-XXXX",
        agents: {
          create: [
            {
              name: "Omar Al Kaabi",
              email: "omar@alwaha.ae",
              phone: "+971-50-222-1111",
            },
          ],
        },
      },
      include: { agents: true },
    }),
    prisma.brokerCompany.create({
      data: {
        name: "Marina Realty Group",
        email: "sales@marinareal.ae",
        phone: "+971-4-XXX-XXXX",
        agents: {
          create: [
            {
              name: "Sara Johnson",
              email: "sara@marinareal.ae",
              phone: "+971-50-333-4444",
            },
            {
              name: "Mohammad Hassan",
              email: "mohammad@marinareal.ae",
              phone: "+971-50-333-5555",
            },
          ],
        },
      },
      include: { agents: true },
    }),
  ]);
  console.log(`✓ ${brokerCompanies.length} broker companies created`);

  // ============================================================
  // Phase 1 expansion: phases, unit type plans, KYC, joint owners,
  // construction milestones, escrow, snag list, handover, etc.
  // ============================================================
  console.log("\n--- Phase 1 expansion seeds ---");

  // Phases (single tower, three staged releases by floor band)
  const phaseLow = await prisma.phase.create({
    data: {
      projectId: project.id,
      name: "Phase 1 — Floors 1-7",
      code: "P1",
      sortOrder: 1,
      floorFrom: 1,
      floorTo: 7,
      releaseStage: "PUBLIC",
      releaseStageAt: new Date(),
    },
  });
  const phaseMid = await prisma.phase.create({
    data: {
      projectId: project.id,
      name: "Phase 2 — Floors 8-13",
      code: "P2",
      sortOrder: 2,
      floorFrom: 8,
      floorTo: 13,
      releaseStage: "BROKER_PREVIEW",
      releaseStageAt: new Date(),
    },
  });
  const phaseHigh = await prisma.phase.create({
    data: {
      projectId: project.id,
      name: "Phase 3 — Floors 14-19 + Penthouses",
      code: "P3",
      sortOrder: 3,
      floorFrom: 14,
      floorTo: 19,
      releaseStage: "INTERNAL",
      releaseStageAt: new Date(),
    },
  });
  console.log(`✓ 3 phases created`);

  // Backfill phaseId on existing units based on floor
  await prisma.unit.updateMany({
    where: { projectId: project.id, floor: { gte: 1, lte: 7 } },
    data: { phaseId: phaseLow.id, tenure: "FREEHOLD" },
  });
  await prisma.unit.updateMany({
    where: { projectId: project.id, floor: { gte: 8, lte: 13 } },
    data: { phaseId: phaseMid.id, tenure: "FREEHOLD" },
  });
  await prisma.unit.updateMany({
    where: { projectId: project.id, floor: { gte: 14 } },
    data: { phaseId: phaseHigh.id, tenure: "FREEHOLD" },
  });
  console.log(`✓ Units backfilled with phase + tenure`);

  // Unit type plans
  const typePlan1BR = await prisma.unitTypePlan.create({
    data: {
      projectId: project.id,
      code: "1BR-A",
      name: "1 Bedroom — Standard",
      type: "ONE_BR",
      area: 77,
      internalArea: 69.5,
      externalArea: 7.5,
      bathrooms: 1,
      parkingSpaces: 1,
      basePrice: 1100000,
    },
  });
  const typePlan2BR = await prisma.unitTypePlan.create({
    data: {
      projectId: project.id,
      code: "2BR-A",
      name: "2 Bedroom — Premium",
      type: "TWO_BR",
      area: 114,
      internalArea: 95.7,
      externalArea: 18.3,
      bathrooms: 2,
      parkingSpaces: 1,
      basePrice: 1850000,
    },
  });
  const typePlanPent = await prisma.unitTypePlan.create({
    data: {
      projectId: project.id,
      code: "PENT-A",
      name: "Penthouse",
      type: "FOUR_BR",
      area: 165,
      internalArea: 92.8,
      externalArea: 71.6,
      bathrooms: 3,
      parkingSpaces: 2,
      basePrice: 4500000,
    },
  });
  console.log(`✓ 3 unit type plans created`);

  // KYC for the first lead (if any leads exist)
  if (leads[0]) {
    await prisma.kYCRecord.create({
      data: {
        leadId: leads[0].id,
        status: "APPROVED",
        riskRating: "LOW",
        idType: "PASSPORT",
        idNumber: "P12345678",
        idIssuingCountry: "AE",
        idIssueDate: new Date("2020-01-15"),
        idExpiryDate: new Date("2030-01-14"),
        nationality: leads[0].nationality ?? "AE",
        residencyStatus: "RESIDENT",
        occupation: "Business Owner",
        sourceOfFunds: "Salary and savings; KYC completed at on-boarding.",
        addressLine1: "Marina Plaza, 12th Floor",
        city: "Dubai",
        country: "AE",
        reviewedAt: new Date(),
        reviewedBy: users[0].email,
      },
    });
    console.log(`✓ KYC record seeded for first lead`);
  }

  // Joint owners on the first deal (if any deals exist)
  if (deals[0] && leads[0]) {
    await prisma.dealParty.create({
      data: {
        dealId: deals[0].id,
        leadId: leads[0].id,
        role: "PRIMARY",
        ownershipPercentage: 100,
      },
    });
    console.log(`✓ Primary deal party seeded`);
  }

  // Construction milestones
  const consMilestones = await Promise.all([
    prisma.constructionMilestone.create({
      data: {
        projectId: project.id,
        phaseId: phaseLow.id,
        stage: "FOUNDATION",
        label: "Foundation Complete",
        percentComplete: 100,
        achievedDate: new Date("2025-06-01"),
      },
    }),
    prisma.constructionMilestone.create({
      data: {
        projectId: project.id,
        phaseId: phaseMid.id,
        stage: "STRUCTURE",
        label: "Structural Frame",
        percentComplete: 60,
        expectedDate: new Date("2026-08-01"),
      },
    }),
    prisma.constructionMilestone.create({
      data: {
        projectId: project.id,
        phaseId: phaseHigh.id,
        stage: "EXCAVATION",
        label: "Excavation Started",
        percentComplete: 25,
        expectedDate: new Date("2026-11-01"),
      },
    }),
  ]);
  console.log(`✓ ${consMilestones.length} construction milestones`);

  // Escrow + trustee account
  const trustee = await prisma.trusteeAccount.create({
    data: {
      projectId: project.id,
      trusteeName: "Emirates Real Estate Trustee",
      registrationNo: "TRU-2026-0001",
      contactEmail: "trustee@example.ae",
    },
  });
  const escrow = await prisma.escrowAccount.create({
    data: {
      projectId: project.id,
      bankName: "Emirates NBD",
      branch: "Dubai Marina",
      accountName: "Samha Tower Escrow",
      accountNo: "0123456789",
      iban: "AE070331234567890123456",
      currency: "AED",
      trusteeAccountId: trustee.id,
    },
  });
  await prisma.escrowLedgerEntry.createMany({
    data: [
      {
        accountId: escrow.id,
        direction: "CREDIT",
        reason: "OPENING_BALANCE",
        amount: 0,
        currency: "AED",
        postedBy: users[0].email,
        notes: "Account opening",
      },
    ],
  });
  console.log(`✓ Escrow + trustee accounts seeded`);

  // Tiered commission rule
  const tieredRule = await prisma.tieredCommissionRule.create({
    data: {
      projectId: project.id,
      name: "Volume-tiered Commission",
      description: "Higher rate for larger deals.",
      isActive: true,
      priority: 0,
      tiers: {
        create: [
          { minSalePrice: 0,        maxSalePrice: 1000000, ratePercent: 2.5, sortOrder: 1 },
          { minSalePrice: 1000000,  maxSalePrice: 2500000, ratePercent: 3.0, sortOrder: 2 },
          { minSalePrice: 2500000,  maxSalePrice: 5000000, ratePercent: 3.5, sortOrder: 3 },
          { minSalePrice: 5000000,                          ratePercent: 4.0, flatBonus: 25000, sortOrder: 4 },
        ],
      },
    },
  });
  console.log(`✓ Tiered commission rule seeded (id=${tieredRule.id})`);

  // Sample snag list on a sold unit (if any)
  const soldUnit = units.find((u: any) => u.status === "SOLD");
  if (soldUnit) {
    const snagList = await prisma.snagList.create({
      data: {
        unitId: soldUnit.id,
        label: "Pre-handover walk-through",
      },
    });
    await prisma.snagItem.create({
      data: {
        listId: snagList.id,
        room: "Living Room",
        category: "Paint",
        description: "Touch-up required on north wall near skirting.",
        severity: "COSMETIC",
        status: "RAISED",
        raisedBy: users[1].email,
      },
    });
    console.log(`✓ Snag list seeded for unit ${soldUnit.unitNumber}`);
  }

  // Sample handover checklist for the first deal if it's late-stage
  if (deals[0]) {
    const checklist = await prisma.handoverChecklist.create({
      data: {
        dealId: deals[0].id,
        unitId: deals[0].unitId,
      },
    });
    const items = [
      { code: "FINAL_PAYMENT", label: "Final payment received", sortOrder: 1 },
      { code: "NOC_SERVICE_CHARGE", label: "Service charge NOC obtained", sortOrder: 2 },
      { code: "UTILITIES_TRANSFERRED", label: "DEWA / cooling transferred", sortOrder: 3 },
      { code: "WALK_THROUGH", label: "Walk-through completed with buyer", sortOrder: 4 },
      { code: "KEY_HANDOVER", label: "Keys + access cards issued", sortOrder: 5 },
      { code: "CUSTOMER_SIGN_OFF", label: "Customer sign-off form signed", sortOrder: 6 },
    ];
    await prisma.handoverChecklistItem.createMany({
      data: items.map((it) => ({ checklistId: checklist.id, ...it })),
    });
    console.log(`✓ Handover checklist (${items.length} items) seeded`);
  }

  // Org number sequences for invoices and receipts (current year)
  const fy = new Date().getFullYear();
  if (project.organizationId) {
    await prisma.orgNumberSequence.createMany({
      data: [
        { organizationId: project.organizationId, sequenceKey: "INVOICE", fiscalYear: fy, prefix: "INV-", nextValue: 1, width: 5 },
        { organizationId: project.organizationId, sequenceKey: "RECEIPT", fiscalYear: fy, prefix: "RCP-", nextValue: 1, width: 5 },
        { organizationId: project.organizationId, sequenceKey: "REFUND",  fiscalYear: fy, prefix: "RFD-", nextValue: 1, width: 5 },
      ],
      skipDuplicates: true,
    });
    console.log(`✓ Org number sequences (INVOICE/RECEIPT/REFUND) for FY${fy} seeded`);
  }

  console.log("\n✅ Database seeding complete!");
  console.log(`Project: ${project.name}`);
  console.log(`Location: ${project.location}`);
  console.log(`Units: ${units.length} (2 retail + ${units.length - 2} residential)`);
  console.log(`Handover: ${project.handoverDate.toDateString()}`);
  console.log(`Payment Plans: ${paymentPlans.length}`);
  console.log(`Leads: ${leads.length}`);
  console.log(`Deals: ${deals.length}`);
  console.log(`\nUsers created:`);
  users.forEach((u) => console.log(`  • ${u.name} (${u.role})`));
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
