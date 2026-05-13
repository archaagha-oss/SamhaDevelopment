/**
 * One-shot backfill: normalize Lead.phone to E.164.
 *
 * Lead phones used to be stored verbatim (the old regex accepted spaces,
 * dashes, parens, double "+", etc.). The service layer now normalizes
 * via libphonenumber-js before write, but historical rows are still
 * messy and won't match a normalized search.
 *
 * Usage:
 *   tsx src/scripts/normalizeLeadPhones.ts                # dry run
 *   tsx src/scripts/normalizeLeadPhones.ts --apply        # write changes
 *
 * Collision handling. Lead.phone is @unique. If normalization would map
 * two existing rows to the same E.164 value, we DO NOT merge them — the
 * second row keeps its raw phone and is reported in the "conflicts"
 * section so a human can review (probably one row should be soft-deleted
 * or its phone manually fixed before re-running).
 */

import { prisma } from "../lib/prisma";
import { normalizePhone } from "../lib/phone";

interface Change {
  id: string;
  name: string;
  before: string;
  after: string;
}
interface Conflict {
  id: string;
  name: string;
  raw: string;
  wouldBecome: string;
  conflictsWithLeadId: string;
}
interface Unparseable {
  id: string;
  name: string;
  raw: string;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const leads = await prisma.lead.findMany({
    select: { id: true, firstName: true, lastName: true, phone: true },
    orderBy: { createdAt: "asc" },
  });

  const changes: Change[] = [];
  const conflicts: Conflict[] = [];
  const unparseable: Unparseable[] = [];
  const seenE164 = new Map<string, string>(); // e164 -> leadId (winner)

  for (const lead of leads) {
    const name = `${lead.firstName} ${lead.lastName}`.trim();
    const e164 = normalizePhone(lead.phone);

    if (!e164) {
      unparseable.push({ id: lead.id, name, raw: lead.phone });
      continue;
    }

    const winner = seenE164.get(e164);
    if (winner && winner !== lead.id) {
      conflicts.push({
        id: lead.id,
        name,
        raw: lead.phone,
        wouldBecome: e164,
        conflictsWithLeadId: winner,
      });
      continue;
    }
    seenE164.set(e164, lead.id);

    if (lead.phone !== e164) {
      changes.push({ id: lead.id, name, before: lead.phone, after: e164 });
    }
  }

  console.log(`\nScanned ${leads.length} leads`);
  console.log(`  Would normalize ${changes.length} phone(s)`);
  console.log(`  Conflicts (duplicates surfaced):  ${conflicts.length}`);
  console.log(`  Unparseable phones:               ${unparseable.length}`);

  if (changes.length) {
    console.log("\nChanges:");
    for (const c of changes.slice(0, 20)) {
      console.log(`  ${c.id}  ${c.name.padEnd(30)}  ${c.before}  →  ${c.after}`);
    }
    if (changes.length > 20) console.log(`  … and ${changes.length - 20} more`);
  }

  if (conflicts.length) {
    console.log("\nConflicts — these rows are NOT updated (review manually):");
    for (const c of conflicts) {
      console.log(`  ${c.id}  ${c.name.padEnd(30)}  raw="${c.raw}"  → ${c.wouldBecome} (taken by ${c.conflictsWithLeadId})`);
    }
  }

  if (unparseable.length) {
    console.log("\nUnparseable — these rows are NOT updated (libphonenumber-js rejected):");
    for (const u of unparseable) {
      console.log(`  ${u.id}  ${u.name.padEnd(30)}  raw="${u.raw}"`);
    }
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to write changes.");
    return;
  }

  console.log("\nApplying changes…");
  let written = 0;
  for (const c of changes) {
    await prisma.lead.update({ where: { id: c.id }, data: { phone: c.after } });
    written++;
  }
  console.log(`Wrote ${written} updates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
