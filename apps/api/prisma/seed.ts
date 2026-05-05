/**
 * Seed default StageDocumentRules (global rules, projectId=null).
 * Run: node -r ts-node/register prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_RULES = [
  { dealStage: "RESERVATION_CONFIRMED" as const, documentType: "RESERVATION_FORM" as const, label: "Signed Reservation Form" },
  { dealStage: "SPA_SIGNED" as const,            documentType: "SPA" as const,               label: "Signed SPA Agreement" },
  { dealStage: "OQOOD_REGISTERED" as const,      documentType: "OQOOD_CERTIFICATE" as const, label: "Oqood Registration Certificate" },
];

async function main() {
  for (const rule of DEFAULT_RULES) {
    const existing = await prisma.stageDocumentRule.findFirst({
      where: { projectId: null, dealStage: rule.dealStage, documentType: rule.documentType },
    });
    if (!existing) {
      await prisma.stageDocumentRule.create({
        data: { ...rule, projectId: null, required: true },
      });
      console.log(`  ✓ created: ${rule.dealStage} → ${rule.documentType}`);
    } else {
      console.log(`  – exists:  ${rule.dealStage} → ${rule.documentType}`);
    }
  }
  console.log("Seeding complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
