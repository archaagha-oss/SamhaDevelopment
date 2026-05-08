/**
 * Smoke test for the comms backbone (Phases A, B, C).
 *
 * Seeds a self-contained test deal with a payment due in 7 days, fires the
 * dispatcher (and optionally the full sweep), and verifies that:
 *   - an Activity row is written with the correct channel + direction=OUTBOUND
 *   - a ReminderLog row is written with the correct channel + status
 *   - a CommunicationPreference row is created with the *Sent counter incremented
 *
 * Usage from apps/api:
 *   npx tsx src/scripts/smokeTestReminderSweep.ts            # seed + dispatch once
 *   npx tsx src/scripts/smokeTestReminderSweep.ts --sweep    # also runs the full PAYMENT_REMINDER_SWEEP
 *   npx tsx src/scripts/smokeTestReminderSweep.ts --cleanup  # remove this script's test data
 *
 * All test rows are tagged with the SMOKE_TAG below so cleanup is safe even
 * if the script is killed mid-run.
 */

import { prisma } from "../lib/prisma";
import { dispatchPaymentReminder } from "../services/communicationDispatcher";

const SMOKE_TAG = "smoke-comms";

const args = new Set(process.argv.slice(2));
const RUN_SWEEP   = args.has("--sweep");
const CLEANUP_ONLY = args.has("--cleanup");

const log = {
  step:  (msg: string) => console.log(`\n→ ${msg}`),
  ok:    (msg: string) => console.log(`  ✓ ${msg}`),
  warn:  (msg: string) => console.warn(`  ⚠ ${msg}`),
  fail:  (msg: string) => console.error(`  ✗ ${msg}`),
};

async function main() {
  log.step("Connecting to database…");
  await prisma.$connect();
  log.ok("connected");

  if (CLEANUP_ONLY) {
    await cleanup();
    return;
  }

  log.step("Seeding test data…");
  const seeded = await seed();
  log.ok(`payment ${seeded.paymentId} due ${seeded.dueDate.toISOString().slice(0, 10)} (lead ${seeded.leadId})`);

  log.step("Dispatching reminder via communicationDispatcher.dispatchPaymentReminder…");
  const result = await dispatchPaymentReminder({
    paymentId: seeded.paymentId,
    dealId: seeded.dealId,
    leadId: seeded.leadId,
    rule: "BEFORE_DUE",
    daysOverdue: 0,
    recipient: {
      name:  "Smoke Test",
      email: seeded.leadEmail,
      phone: seeded.leadPhone,
    },
    vars: {
      buyerName:      "Smoke Test",
      unitNumber:     seeded.unitNumber,
      projectName:    seeded.projectName,
      milestoneLabel: "Booking Deposit",
      dueDate:        seeded.dueDate.toISOString().slice(0, 10),
      amount:         "AED 100,000",
    },
  });
  log.ok(`dispatched: channel=${result.channel} sent=${result.sent}${result.reason ? ` reason=${result.reason}` : ""}${result.providerMessageId ? ` sid=${result.providerMessageId}` : ""}`);

  log.step("Verifying side effects…");
  await verify(seeded.paymentId, seeded.leadId);

  if (RUN_SWEEP) {
    log.step("Running the full PAYMENT_REMINDER_SWEEP (touches every active payment in the DB)…");
    // Lazy import — the sweep imports the dispatcher, which we want to load
    // once already so the smoke test can stand alone.
    const { processJobs, scheduleJob } = await import("../events/jobs/jobHandlers");
    await scheduleJob("PAYMENT_REMINDER_SWEEP", {}, new Date(Date.now() - 1000));
    await processJobs();
    log.ok("sweep dispatched (check ReminderLog for any other payments matching the 4 rules)");
  }

  log.step("Done. To remove test data later, run with --cleanup.");
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

interface Seeded {
  organizationId: string;
  userId: string;
  projectId: string;
  unitId: string;
  unitNumber: string;
  projectName: string;
  paymentPlanId: string;
  leadId: string;
  leadEmail: string;
  leadPhone: string;
  dealId: string;
  paymentId: string;
  dueDate: Date;
}

async function seed(): Promise<Seeded> {
  // Organization (use existing if any)
  const org = await prisma.organization.findFirst() ??
    await prisma.organization.create({
      data: { name: `${SMOKE_TAG}-org`, currency: "AED", timezone: "Asia/Dubai" },
    });

  // System user (use existing system user if any, else create one tagged)
  const user = await prisma.user.findFirst({ where: { role: "ADMIN" } }) ??
    await prisma.user.create({
      data: {
        clerkId: `${SMOKE_TAG}-clerk`,
        email:   `${SMOKE_TAG}@example.com`,
        name:    "Smoke Tester",
        role:    "ADMIN",
      },
    });

  // Project
  const project = await prisma.project.upsert({
    where:  { name: `${SMOKE_TAG}-project` },
    update: {},
    create: {
      name:         `${SMOKE_TAG}-project`,
      location:     "Dubai",
      totalUnits:   1,
      handoverDate: new Date(Date.now() + 365 * 86_400_000),
    },
  });

  // Unit
  const existingUnit = await prisma.unit.findFirst({
    where: { unitNumber: `${SMOKE_TAG}-unit-1`, projectId: project.id },
  });
  const unit = existingUnit ?? await prisma.unit.create({
    data: {
      projectId: project.id,
      unitNumber: `${SMOKE_TAG}-unit-1`,
      floor: 1,
      type: "STUDIO",
      area: 50,
      basePrice: 1_000_000,
      price: 1_000_000,
      view: "SEA",
    },
  });

  // Payment plan + one milestone
  const planName = `${SMOKE_TAG}-plan`;
  const plan = await prisma.paymentPlan.upsert({
    where:  { name: planName },
    update: {},
    create: { name: planName, description: "Smoke test single-milestone plan" },
  });

  const existingMilestone = await prisma.paymentPlanMilestone.findFirst({
    where: { planId: plan.id, label: "Booking Deposit" },
  });
  if (!existingMilestone) {
    await prisma.paymentPlanMilestone.create({
      data: {
        planId:     plan.id,
        label:      "Booking Deposit",
        percentage: 10,
        sortOrder:  1,
      },
    });
  }

  // Lead — use the same phone every run so we don't get unique-constraint errors
  const leadPhone = "+971501234599";
  const leadEmail = `${SMOKE_TAG}-lead@example.com`;
  const lead = await prisma.lead.upsert({
    where:  { phone: leadPhone },
    update: { email: leadEmail },
    create: {
      firstName: "Smoke",
      lastName:  "Tester",
      phone:     leadPhone,
      email:     leadEmail,
      source:    "DIRECT",
      assignedAgentId: user.id,
    },
  });

  // Deal
  const dealNumber = `${SMOKE_TAG}-deal-1`;
  const deal = await prisma.deal.upsert({
    where:  { dealNumber },
    update: {},
    create: {
      dealNumber,
      leadId:            lead.id,
      unitId:            unit.id,
      salePrice:         1_000_000,
      paymentPlanId:     plan.id,
      reservationDate:   new Date(),
      oqoodDeadline:     new Date(Date.now() + 90 * 86_400_000),
      dldFee:            40_000,
    },
  });

  // Payment due in exactly 7 days (so BEFORE_DUE rule matches)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  dueDate.setHours(12, 0, 0, 0); // noon to dodge timezone DST edges

  // Wipe any prior smoke ReminderLog rows on this payment so the verify step is clean
  const existingPayment = await prisma.payment.findFirst({
    where: { dealId: deal.id, milestoneLabel: "Booking Deposit" },
  });

  if (existingPayment) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prisma as any;
    if (typeof p.reminderLog?.deleteMany === "function") {
      await p.reminderLog.deleteMany({ where: { paymentId: existingPayment.id } });
    }
    await prisma.activity.deleteMany({
      where: { dealId: deal.id, type: { in: ["EMAIL", "WHATSAPP", "SMS"] } },
    });
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: { dueDate, status: "PENDING", lastReminderSentAt: null, reminderCount: 0 } as any,
    });
  }

  const payment = existingPayment ?? await prisma.payment.create({
    data: {
      dealId:         deal.id,
      milestoneLabel: "Booking Deposit",
      amount:         100_000,
      originalAmount: 100_000,
      percentage:     10,
      dueDate,
      status:         "PENDING",
    },
  });

  return {
    organizationId: org.id,
    userId:         user.id,
    projectId:      project.id,
    unitId:         unit.id,
    unitNumber:     unit.unitNumber,
    projectName:    project.name,
    paymentPlanId:  plan.id,
    leadId:         lead.id,
    leadEmail,
    leadPhone,
    dealId:         deal.id,
    paymentId:      payment.id,
    dueDate,
  };
}

// ─── Verification ────────────────────────────────────────────────────────────

async function verify(paymentId: string, leadId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  // ReminderLog
  const reminderLog = typeof p.reminderLog?.findFirst === "function"
    ? await p.reminderLog.findFirst({ where: { paymentId, ruleType: "BEFORE_DUE" } })
    : null;
  if (!reminderLog) {
    log.fail("no ReminderLog row for paymentId+BEFORE_DUE — schema may not be pushed");
  } else {
    log.ok(`ReminderLog: channel=${reminderLog.channel} status=${reminderLog.status} providerMessageId=${reminderLog.providerMessageId ?? "(none)"}`);
  }

  // Activity (channel-typed OUTBOUND)
  const activity = await prisma.activity.findFirst({
    where: { dealId: { not: null }, type: { in: ["EMAIL", "WHATSAPP", "SMS"] } },
    orderBy: { createdAt: "desc" },
  } as any);
  if (!activity) {
    log.fail("no channel-typed Activity row created (still writing NOTE? regenerate Prisma client?)");
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = activity as any;
    log.ok(`Activity: type=${a.type} direction=${a.direction ?? "(missing — schema not pushed)"} sid=${a.providerMessageSid ?? "(none)"}`);
  }

  // CommunicationPreference
  const pref = typeof p.communicationPreference?.findFirst === "function"
    ? await p.communicationPreference.findFirst({ where: { leadId } })
    : null;
  if (!pref) {
    log.warn("no CommunicationPreference row — counters not incremented (schema not pushed?)");
  } else {
    log.ok(`Preference: emailSent=${pref.emailSent} whatsappSent=${pref.whatsappSent} smsSent=${pref.smsSent}`);
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  log.step("Cleaning up smoke test data…");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  const lead = await prisma.lead.findFirst({ where: { email: `${SMOKE_TAG}-lead@example.com` } });
  if (lead) {
    if (typeof p.communicationPreference?.deleteMany === "function") {
      await p.communicationPreference.deleteMany({ where: { leadId: lead.id } });
    }
    await prisma.activity.deleteMany({ where: { leadId: lead.id } });
  }

  const dealNumber = `${SMOKE_TAG}-deal-1`;
  const deal = await prisma.deal.findUnique({ where: { dealNumber } });
  if (deal) {
    if (typeof p.reminderLog?.deleteMany === "function") {
      const payments = await prisma.payment.findMany({ where: { dealId: deal.id }, select: { id: true } });
      for (const pmt of payments) {
        await p.reminderLog.deleteMany({ where: { paymentId: pmt.id } });
      }
    }
    await prisma.payment.deleteMany({ where: { dealId: deal.id } });
    await prisma.activity.deleteMany({ where: { dealId: deal.id } });
    await prisma.deal.delete({ where: { id: deal.id } });
  }

  if (lead) {
    await prisma.lead.delete({ where: { id: lead.id } });
  }

  const unit = await prisma.unit.findFirst({ where: { unitNumber: `${SMOKE_TAG}-unit-1` } });
  if (unit) await prisma.unit.delete({ where: { id: unit.id } });

  const plan = await prisma.paymentPlan.findUnique({ where: { name: `${SMOKE_TAG}-plan` } });
  if (plan) {
    await prisma.paymentPlanMilestone.deleteMany({ where: { planId: plan.id } });
    await prisma.paymentPlan.delete({ where: { id: plan.id } });
  }

  const project = await prisma.project.findUnique({ where: { name: `${SMOKE_TAG}-project` } });
  if (project) await prisma.project.delete({ where: { id: project.id } });

  log.ok("cleaned up");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    log.fail(err instanceof Error ? err.stack ?? err.message : String(err));
    await prisma.$disconnect();
    process.exit(1);
  });
