// ============================================================
// One-shot backfill: mirror existing Lead, BrokerCompany, and
// BrokerAgent records into the Contact table so the Contacts
// module is a complete master directory before launch.
//
// Run with:   tsx apps/api/src/db/backfillContacts.ts
// Idempotent: re-running updates existing mirrors instead of
// creating duplicates.
// ============================================================

import { prisma } from "../lib/prisma";
import { syncContactFromSource } from "../services/contactService";

async function backfillLeads(): Promise<number> {
  const leads = await prisma.lead.findMany({
    include: { brokerCompany: { select: { name: true } } },
  });
  for (const lead of leads) {
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
  }
  return leads.length;
}

async function backfillBrokerCompanies(): Promise<number> {
  const companies = await prisma.brokerCompany.findMany();
  for (const company of companies) {
    await syncContactFromSource({
      ref: { kind: "broker-company", id: company.id },
      firstName: company.name,
      email:     company.email,
      phone:     company.phone,
      company:   company.name,
      jobTitle:  "Broker Company",
    });
  }
  return companies.length;
}

async function backfillBrokerAgents(): Promise<number> {
  const agents = await prisma.brokerAgent.findMany({
    include: { company: { select: { name: true } } },
  });
  for (const agent of agents) {
    await syncContactFromSource({
      ref: { kind: "broker-agent", id: agent.id },
      firstName: agent.firstName ?? agent.name,
      lastName:  agent.lastName,
      email:     agent.email,
      phone:     agent.phone,
      company:   agent.company?.name ?? null,
      jobTitle:  "Broker Agent",
    });
  }
  return agents.length;
}

async function main() {
  console.log("[backfillContacts] starting…");
  const leadCount = await backfillLeads();
  console.log(`[backfillContacts] mirrored ${leadCount} leads`);
  const companyCount = await backfillBrokerCompanies();
  console.log(`[backfillContacts] mirrored ${companyCount} broker companies`);
  const agentCount = await backfillBrokerAgents();
  console.log(`[backfillContacts] mirrored ${agentCount} broker agents`);
  console.log("[backfillContacts] done.");
}

main()
  .catch((err) => {
    console.error("[backfillContacts] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
