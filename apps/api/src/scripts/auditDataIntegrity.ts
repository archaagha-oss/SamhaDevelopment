/**
 * Data Integrity Audit Script
 * Verifies that all relationships are consistent across units, leads, and deals
 */

import { prisma } from "../lib/prisma";

async function auditDataIntegrity() {
  console.log("🔍 Starting Data Integrity Audit...\n");

  try {
    // 1. Check for orphaned leads
    console.log("1️⃣ Checking for orphaned leads...");
    const leadsWithoutAgent = await prisma.lead.count({
      where: { assignedAgent: null },
    });
    if (leadsWithoutAgent > 0) {
      console.warn(`⚠️ Found ${leadsWithoutAgent} leads without assigned agent`);
    } else {
      console.log("✅ All leads have assigned agents");
    }

    // 2. Check for units with invalid statuses
    console.log("\n2️⃣ Checking unit statuses...");
    const unitsByStatus = await prisma.unit.groupBy({
      by: ["status"],
      _count: true,
    });
    console.log("Unit status distribution:");
    unitsByStatus.forEach((s) => console.log(`   ${s.status}: ${s._count}`));

    // 3. Check for units in deal-owned statuses WITHOUT active deals
    console.log("\n3️⃣ Checking for units in deal-owned statuses without deals...");
    const dealOwnedStatuses = ["ON_HOLD", "RESERVED", "BOOKED", "SOLD", "HANDED_OVER"];
    const orphanedUnits = await prisma.unit.findMany({
      where: {
        status: { in: dealOwnedStatuses as any },
      },
      include: {
        deals: { where: { isActive: true } },
      },
    });

    const orphaned = orphanedUnits.filter((u) => u.deals.length === 0);
    if (orphaned.length > 0) {
      console.error(`❌ Found ${orphaned.length} units in deal-owned status without active deals:`);
      orphaned.forEach((u) => {
        console.error(`   Unit ${u.unitNumber} (ID: ${u.id}) - Status: ${u.status}`);
      });
    } else {
      console.log("✅ All units in deal-owned statuses have active deals");
    }

    // 4. Check for deals with missing relationships
    console.log("\n4️⃣ Checking deal relationships...");
    const dealsWithMissingData = await prisma.deal.findMany({
      where: {
        OR: [
          { lead: null },
          { unit: null },
          { paymentPlan: null },
        ],
      },
      select: { id: true, dealNumber: true, leadId: true, unitId: true, paymentPlanId: true },
    });

    if (dealsWithMissingData.length > 0) {
      console.error(`❌ Found ${dealsWithMissingData.length} deals with missing relationships:`);
      dealsWithMissingData.forEach((d) => {
        console.error(`   Deal ${d.dealNumber}`);
        if (!d.leadId) console.error(`      - Missing lead`);
        if (!d.unitId) console.error(`      - Missing unit`);
        if (!d.paymentPlanId) console.error(`      - Missing paymentPlan`);
      });
    } else {
      console.log("✅ All deals have required relationships");
    }

    // 5. Check for leads with inactive units they're interested in
    console.log("\n5️⃣ Checking lead interests...");
    const leadsWithInterests = await prisma.lead.findMany({
      include: {
        interests: { include: { unit: true } },
      },
    });

    let interestIssues = 0;
    leadsWithInterests.forEach((lead) => {
      lead.interests.forEach((interest) => {
        if (!interest.unit) {
          console.error(`❌ Lead ${lead.id} has interest in deleted unit ${interest.unitId}`);
          interestIssues++;
        }
      });
    });

    if (interestIssues === 0) {
      console.log("✅ All lead interests point to valid units");
    }

    // 6. Check payment integrity
    console.log("\n6️⃣ Checking payment integrity...");
    const dealsWithoutPayments = await prisma.deal.findMany({
      where: {
        payments: { none: {} },
        stage: { notIn: ["CANCELLED"] },
      },
      select: { id: true, dealNumber: true, stage: true },
    });

    if (dealsWithoutPayments.length > 0) {
      console.warn(`⚠️ Found ${dealsWithoutPayments.length} non-cancelled deals without payments:`);
      dealsWithoutPayments.forEach((d) => {
        console.warn(`   Deal ${d.dealNumber} - Stage: ${d.stage}`);
      });
    } else {
      console.log("✅ All active deals have payment records");
    }

    // 7. Summary statistics
    console.log("\n📊 Summary Statistics:");
    const stats = await Promise.all([
      prisma.unit.count(),
      prisma.lead.count(),
      prisma.deal.count(),
      prisma.payment.count(),
      prisma.offer.count(),
      prisma.reservation.count(),
    ]);

    console.log(`   Total Units: ${stats[0]}`);
    console.log(`   Total Leads: ${stats[1]}`);
    console.log(`   Total Deals: ${stats[2]}`);
    console.log(`   Total Payments: ${stats[3]}`);
    console.log(`   Total Offers: ${stats[4]}`);
    console.log(`   Total Reservations: ${stats[5]}`);

    console.log("\n✨ Data integrity audit complete!");
  } catch (error) {
    console.error("Error during audit:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run audit
auditDataIntegrity();
