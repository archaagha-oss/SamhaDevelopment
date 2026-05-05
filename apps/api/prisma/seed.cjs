/**
 * Seed default StageDocumentRules (global rules, projectId=null).
 * Run: node prisma/seed.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DEFAULT_RULES = [
  { dealStage: "RESERVATION_CONFIRMED", documentType: "RESERVATION_FORM", label: "Signed Reservation Form" },
  { dealStage: "SPA_SIGNED",            documentType: "SPA",               label: "Signed SPA Agreement" },
  { dealStage: "OQOOD_REGISTERED",      documentType: "OQOOD_CERTIFICATE", label: "Oqood Registration Certificate" },
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
      console.log(`  created: ${rule.dealStage} -> ${rule.documentType}`);
    } else {
      console.log(`  exists:  ${rule.dealStage} -> ${rule.documentType}`);
    }
  }
  console.log("Seeding complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
