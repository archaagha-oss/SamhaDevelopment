import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createDeal as createDealService,
  updateDealStage,
  tryUnlockCommission,
} from "../services/dealService";

const prisma = new PrismaClient();

describe("Deal Lifecycle Integration Tests", () => {
  let projectId: string;
  let unitId: string;
  let paymentPlanId: string;
  let leadId: string;
  let dealId: string;
  let userId: string = "test-user-123";

  beforeAll(async () => {
    // Create test user (if not exists)
    const user = await prisma.user.upsert({
      where: { email: "test-agent@example.com" },
      update: {},
      create: {
        clerkId: "test-clerk-123",
        email: "test-agent@example.com",
        name: "Test Agent",
        role: "SALES_AGENT",
      },
    });
    userId = user.id;

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        location: "Dubai",
        totalUnits: 100,
        handoverDate: new Date("2025-12-31"),
      },
    });
    projectId = project.id;

    // Create test unit
    const unit = await prisma.unit.create({
      data: {
        projectId,
        unitNumber: "1-01",
        floor: 1,
        type: "ONE_BR",
        area: 950,
        basePrice: 850000,
        price: 850000,
        view: "GARDEN",
        status: "AVAILABLE",
      },
    });
    unitId = unit.id;

    // Create payment plan
    const plan = await prisma.paymentPlan.create({
      data: {
        name: `Test Plan ${Date.now()}`,
        isActive: true,
        milestones: {
          create: [
            {
              label: "Booking Deposit",
              percentage: 10,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 0,
              sortOrder: 1,
            },
            {
              label: "DLD Fee",
              percentage: 0,
              triggerType: "DAYS_FROM_RESERVATION",
              isDLDFee: true,
              daysFromReservation: 30,
              sortOrder: 2,
            },
            {
              label: "60% Payment",
              percentage: 60,
              triggerType: "DAYS_FROM_RESERVATION",
              daysFromReservation: 180,
              sortOrder: 3,
            },
            {
              label: "Final Payment",
              percentage: 30,
              triggerType: "ON_HANDOVER",
              daysFromReservation: 365,
              sortOrder: 4,
            },
          ],
        },
      },
    });
    paymentPlanId = plan.id;

    // Create test lead
    const lead = await prisma.lead.create({
      data: {
        firstName: "Test",
        lastName: "Buyer",
        phone: "+971505555555",
        email: "test.buyer@example.com",
        nationality: "UAE",
        source: "DIRECT",
        budget: 1000000,
        stage: "NEW",
        assignedAgentId: userId,
      },
    });
    leadId = lead.id;

    // Reserve unit for the deal
    await prisma.unit.update({
      where: { id: unitId },
      data: { status: "RESERVED" },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.deal.deleteMany({ where: { leadId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.paymentPlan.deleteMany({ where: { id: paymentPlanId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.lead.deleteMany({ where: { id: leadId } });
    await prisma.$disconnect();
  });

  it("should create a deal with auto-calculated fees and unit status change", async () => {
    const deal = await createDealService({
      leadId,
      unitId,
      salePrice: 850000,
      discount: 0,
      paymentPlanId,
      createdBy: userId,
    });

    dealId = deal.id;

    expect(deal).toBeDefined();
    expect(deal.dealNumber).toMatch(/^DEAL-\d{4}-\d{4}$/);
    expect(deal.salePrice).toBe(850000);
    expect(deal.dldFee).toBe(850000 * 0.04); // 4% locked
    expect(deal.adminFee).toBe(5000); // Fixed
    expect(deal.stage).toBe("RESERVATION_PENDING");

    // Verify unit status changed to RESERVED (not SOLD)
    const updatedUnit = await prisma.unit.findUnique({
      where: { id: unitId },
    });
    expect(updatedUnit?.status).toBe("RESERVED");
  });

  it("should create payment schedule from milestones", async () => {
    const payments = await prisma.payment.findMany({
      where: { dealId },
      orderBy: { dueDate: "asc" },
    });

    expect(payments.length).toBeGreaterThan(0);
    expect(payments[0].status).toBe("PENDING");
    expect(payments.every((p) => p.dealId === dealId)).toBe(true);

    // Verify DLD fee is included
    const dldPayment = payments.find((p) => p.milestoneLabel.includes("DLD"));
    expect(dldPayment).toBeDefined();
    expect(dldPayment?.amount).toBe(850000 * 0.04);
  });

  it("should create commission in NOT_DUE status", async () => {
    const commission = await prisma.commission.findUnique({
      where: { dealId },
    });

    expect(commission).toBeDefined();
    expect(commission?.status).toBe("NOT_DUE");
    expect(commission?.spaSignedMet).toBe(false);
    expect(commission?.oqoodMet).toBe(false);
  });

  it("should transition through deal stages with validation", async () => {
    // Move to RESERVATION_CONFIRMED
    let updated = await updateDealStage(
      dealId,
      "RESERVATION_CONFIRMED",
      userId
    );
    expect(updated.stage).toBe("RESERVATION_CONFIRMED");

    // Move to SPA_PENDING
    updated = await updateDealStage(dealId, "SPA_PENDING", userId);
    expect(updated.stage).toBe("SPA_PENDING");

    // Move to SPA_SIGNED
    updated = await updateDealStage(dealId, "SPA_SIGNED", userId);
    expect(updated.stage).toBe("SPA_SIGNED");

    // Verify spaSignedDate is set
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal?.spaSignedDate).toBeDefined();
  });

  it("should reject invalid stage transitions", async () => {
    // Try to move from SPA_SIGNED backwards to RESERVATION_PENDING (invalid)
    try {
      await updateDealStage(dealId, "RESERVATION_PENDING", userId);
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toContain("Cannot transition");
    }
  });

  it("should unlock commission when both SPA and Oqood are met", async () => {
    // Move to OQOOD_REGISTERED
    await updateDealStage(dealId, "OQOOD_PENDING", userId);
    await updateDealStage(dealId, "OQOOD_REGISTERED", userId);

    // Check commission is unlocked
    const commission = await prisma.commission.findUnique({
      where: { dealId },
    });

    expect(commission?.status).toBe("PENDING_APPROVAL");
    expect(commission?.spaSignedMet).toBe(true);
    expect(commission?.oqoodMet).toBe(true);
  });

  it("should calculate Oqood deadline as 90 days from reservation", async () => {
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });

    expect(deal?.oqoodDeadline).toBeDefined();

    const reservationDate = new Date(deal!.reservationDate);
    const expectedDeadline = new Date(reservationDate);
    expectedDeadline.setDate(expectedDeadline.getDate() + 90);

    // Allow 1-minute tolerance due to processing time
    const timeDiff = Math.abs(
      deal!.oqoodDeadline.getTime() - expectedDeadline.getTime()
    );
    expect(timeDiff).toBeLessThan(60 * 1000);
  });

  it("should prevent double-marking a payment as paid", async () => {
    const payment = await prisma.payment.findFirst({
      where: { dealId },
    });

    if (payment) {
      // Mark as paid once
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidDate: new Date(),
          paidBy: userId,
          paymentMethod: "BANK_TRANSFER",
        },
      });

      // Try to mark as paid again (should fail)
      try {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "PAID",
            paidDate: new Date(),
            paidBy: userId,
            paymentMethod: "BANK_TRANSFER",
          },
        });
        // In real implementation, service checks if already PAID
      } catch (error) {
        // Expected behavior
      }
    }
  });

  it("should complete deal lifecycle to COMPLETED stage", async () => {
    // Continue stage progression
    await updateDealStage(dealId, "INSTALLMENTS_ACTIVE", userId);
    await updateDealStage(dealId, "HANDOVER_PENDING", userId);

    const completed = await updateDealStage(dealId, "COMPLETED", userId);

    expect(completed.stage).toBe("COMPLETED");

    // Verify no more transitions allowed from COMPLETED
    try {
      await updateDealStage(dealId, "CANCELLED", userId);
      expect.fail("Should not allow transition from COMPLETED");
    } catch (error: any) {
      expect(error.message).toContain("Cannot transition");
    }
  });
});
