import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";

// ─── Brand & shared styling ───────────────────────────────────────────────────

const BRAND = {
  primary:    "FF1E3A8A", // deep blue — title bar
  header:     "FF366092", // table header
  subHeader:  "FFE2E8F0", // meta block / banded rows
  totals:     "FFF1F5F9", // totals strip
  positive:   "FFD1FAE5", // green tint
  warning:    "FFFEF3C7", // amber tint
  negative:   "FFFEE2E2", // red tint
  textOnDark: "FFFFFFFF",
};

const FMT = {
  aed:     '"AED" #,##0.00;[Red]-"AED" #,##0.00',
  number:  "#,##0",
  percent: "0.0%",
  date:    "dd-mmm-yyyy",
};

type ColumnDef = {
  header: string;
  key: string;
  width?: number;
  /** "currency" | "number" | "percent" | "date" | "text" */
  type?: "currency" | "number" | "percent" | "date" | "text";
  /** sum column in totals row */
  total?: boolean;
};

interface ReportMeta {
  title: string;
  subtitle?: string;
  filters?: Record<string, string | number | undefined | null>;
  generatedBy?: string;
}

/**
 * Create a workbook with brand metadata and a primary sheet
 * laid out with a banner title + filter/meta block.
 *
 * Returns the sheet positioned at the row where data should begin.
 */
function createReportSheet(workbook: ExcelJS.Workbook, sheetName: string, meta: ReportMeta) {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 0, xSplit: 0 }],
    properties: { defaultRowHeight: 18 },
  });

  // ─ Banner ─
  sheet.mergeCells("A1:H1");
  const banner = sheet.getCell("A1");
  banner.value = meta.title;
  banner.font = { name: "Calibri", size: 16, bold: true, color: { argb: BRAND.textOnDark } };
  banner.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.primary } };
  sheet.getRow(1).height = 28;

  if (meta.subtitle) {
    sheet.mergeCells("A2:H2");
    const sub = sheet.getCell("A2");
    sub.value = meta.subtitle;
    sub.font = { italic: true, color: { argb: "FF475569" } };
    sub.alignment = { horizontal: "left", indent: 1 };
  }

  // ─ Meta block (Generated / Filters) ─
  let row = meta.subtitle ? 3 : 2;
  const generated = `Generated: ${new Date().toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}`;
  sheet.mergeCells(`A${row}:D${row}`);
  sheet.getCell(`A${row}`).value = generated;
  sheet.getCell(`A${row}`).font = { color: { argb: "FF64748B" }, size: 10 };
  sheet.getCell(`A${row}`).alignment = { horizontal: "left", indent: 1 };

  if (meta.generatedBy) {
    sheet.mergeCells(`E${row}:H${row}`);
    sheet.getCell(`E${row}`).value = `By: ${meta.generatedBy}`;
    sheet.getCell(`E${row}`).font = { color: { argb: "FF64748B" }, size: 10 };
  }

  if (meta.filters && Object.keys(meta.filters).length) {
    const parts = Object.entries(meta.filters)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join("   |   ");
    if (parts) {
      row++;
      sheet.mergeCells(`A${row}:H${row}`);
      sheet.getCell(`A${row}`).value = `Filters → ${parts}`;
      sheet.getCell(`A${row}`).font = { color: { argb: "FF334155" }, size: 10, italic: true };
      sheet.getCell(`A${row}`).alignment = { horizontal: "left", indent: 1 };
    }
  }

  // gap
  row += 2;

  return { sheet, startRow: row };
}

/**
 * Render a styled data table at the given start row.
 * Returns the row index AFTER the table (incl. totals row if present).
 */
function addDataTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  columns: ColumnDef[],
  rows: Record<string, unknown>[],
  options?: { withTotals?: boolean; banded?: boolean; freezeHeader?: boolean }
): number {
  const opts = { withTotals: true, banded: true, freezeHeader: true, ...(options ?? {}) };

  // Column widths
  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width ?? Math.max(12, col.header.length + 4);
  });

  // Header row
  const headerRow = sheet.getRow(startRow);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: BRAND.textOnDark }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.header } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF1E40AF" } },
    };
  });
  headerRow.height = 22;

  // Data rows
  rows.forEach((data, idx) => {
    const r = sheet.getRow(startRow + 1 + idx);
    columns.forEach((col, i) => {
      const cell = r.getCell(i + 1);
      const value = data[col.key];
      cell.value = value as ExcelJS.CellValue;
      switch (col.type) {
        case "currency": cell.numFmt = FMT.aed; cell.alignment = { horizontal: "right" }; break;
        case "number":   cell.numFmt = FMT.number; cell.alignment = { horizontal: "right" }; break;
        case "percent":  cell.numFmt = FMT.percent; cell.alignment = { horizontal: "right" }; break;
        case "date":     cell.numFmt = FMT.date; cell.alignment = { horizontal: "center" }; break;
        default:         cell.alignment = { horizontal: "left", indent: 1 };
      }
      if (opts.banded && idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.subHeader } };
      }
    });
  });

  // Totals row
  let nextRow = startRow + 1 + rows.length;
  if (opts.withTotals && rows.length > 0 && columns.some((c) => c.total)) {
    const totalsRow = sheet.getRow(nextRow);
    columns.forEach((col, i) => {
      const cell = totalsRow.getCell(i + 1);
      cell.font = { bold: true, color: { argb: "FF0F172A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.totals } };
      cell.border = { top: { style: "medium", color: { argb: "FF94A3B8" } } };
      if (i === 0) {
        cell.value = "TOTAL";
        cell.alignment = { horizontal: "left", indent: 1 };
      } else if (col.total) {
        const sum = rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
        cell.value = sum;
        cell.numFmt = col.type === "percent" ? FMT.percent : col.type === "number" ? FMT.number : FMT.aed;
        cell.alignment = { horizontal: "right" };
      }
    });
    nextRow++;
  }

  // Autofilter on header
  const lastCol = String.fromCharCode(64 + columns.length);
  sheet.autoFilter = { from: `A${startRow}`, to: `${lastCol}${startRow + rows.length}` };

  // Freeze header
  if (opts.freezeHeader) {
    sheet.views = [{ state: "frozen", ySplit: startRow, xSplit: 0 }];
  }

  return nextRow + 1;
}

/** Add a small KPI summary block (label / value pairs) in a 2-col layout */
function addSummaryBlock(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  pairs: Array<{ label: string; value: number | string; type?: ColumnDef["type"] }>
): number {
  const titleCell = sheet.getCell(`A${startRow}`);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };

  let r = startRow + 1;
  pairs.forEach((p) => {
    const labelCell = sheet.getCell(`A${r}`);
    const valueCell = sheet.getCell(`B${r}`);
    labelCell.value = p.label;
    labelCell.font = { color: { argb: "FF334155" } };
    valueCell.value = p.value as ExcelJS.CellValue;
    valueCell.font = { bold: true };
    switch (p.type) {
      case "currency": valueCell.numFmt = FMT.aed; break;
      case "number":   valueCell.numFmt = FMT.number; break;
      case "percent":  valueCell.numFmt = FMT.percent; break;
      case "date":     valueCell.numFmt = FMT.date; break;
    }
    r++;
  });
  return r + 1;
}

const fullName = (l?: { firstName?: string | null; lastName?: string | null } | null) =>
  l ? `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() : "";

// ─── Existing exports (now using the new builder) ────────────────────────────

/**
 * Commission Statement for a broker company
 */
export async function generateCommissionStatement(brokerCompanyId: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Samha CRM";
  workbook.created = new Date();

  const commissions = await prisma.commission.findMany({
    where: { brokerCompanyId },
    include: {
      deal: { include: { lead: true, unit: true } },
      brokerCompany: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const company = commissions[0]?.brokerCompany;

  const { sheet, startRow } = createReportSheet(workbook, "Commission Statement", {
    title: `${company?.name ?? "Broker"} — Commission Statement`,
    subtitle: "Earned, approved, and paid commissions across all deals",
    filters: { Broker: company?.name ?? brokerCompanyId },
  });

  const rows = commissions.map((c) => ({
    dealNumber:   c.deal.dealNumber,
    leadName:     fullName(c.deal.lead),
    unit:         c.deal.unit.unitNumber,
    rate:         c.rate / 100,
    amount:       c.amount,
    status:       c.status,
    approvedDate: c.approvedDate ? new Date(c.approvedDate) : null,
    paidDate:     c.paidDate ? new Date(c.paidDate) : null,
    paidAmount:   c.paidAmount ?? 0,
    outstanding:  Math.max(0, c.amount - (c.paidAmount ?? 0)),
  }));

  const after = addDataTable(sheet, startRow, [
    { header: "Deal #",       key: "dealNumber",   width: 16, type: "text" },
    { header: "Buyer",        key: "leadName",     width: 26, type: "text" },
    { header: "Unit",         key: "unit",         width: 12, type: "text" },
    { header: "Rate",         key: "rate",         width: 10, type: "percent" },
    { header: "Amount",       key: "amount",       width: 18, type: "currency", total: true },
    { header: "Status",       key: "status",       width: 18, type: "text" },
    { header: "Approved",     key: "approvedDate", width: 14, type: "date" },
    { header: "Paid On",      key: "paidDate",     width: 14, type: "date" },
    { header: "Paid Amount",  key: "paidAmount",   width: 16, type: "currency", total: true },
    { header: "Outstanding",  key: "outstanding",  width: 16, type: "currency", total: true },
  ], rows);

  // Status conditional fill
  rows.forEach((_, i) => {
    const r = sheet.getRow(startRow + 1 + i);
    const statusCell = r.getCell(6);
    const status = String(statusCell.value);
    if (status === "PAID") statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.positive } };
    else if (status === "PENDING_APPROVAL") statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.warning } };
    else if (status === "NOT_DUE") statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.subHeader } };
  });

  const totalAmt    = rows.reduce((s, r) => s + r.amount, 0);
  const totalPaid   = rows.reduce((s, r) => s + (r.paidAmount ?? 0), 0);
  addSummaryBlock(sheet, after, "Summary", [
    { label: "Total Commission",     value: totalAmt,             type: "currency" },
    { label: "Total Paid",           value: totalPaid,            type: "currency" },
    { label: "Outstanding",          value: totalAmt - totalPaid, type: "currency" },
    { label: "Number of Deals",      value: rows.length,          type: "number" },
  ]);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/**
 * Deal Report — list + summary + filters
 */
export async function generateDealReport(
  filters?: { stage?: string; startDate?: Date; endDate?: Date }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Samha CRM";
  workbook.created = new Date();

  const where: any = {};
  if (filters?.stage) where.stage = filters.stage;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const deals = await prisma.deal.findMany({
    where,
    include: { lead: true, unit: true, payments: true, commission: true },
    orderBy: { createdAt: "desc" },
  });

  const { sheet, startRow } = createReportSheet(workbook, "Deals", {
    title: "Deals Report",
    subtitle: "All deals with sale price, fees, payments, and commission status",
    filters: {
      Stage: filters?.stage ?? "All",
      From:  filters?.startDate ? filters.startDate.toLocaleDateString("en-AE") : "—",
      To:    filters?.endDate   ? filters.endDate.toLocaleDateString("en-AE")   : "—",
    },
  });

  const rows = deals.map((d) => {
    const collected = d.payments.filter((p) => p.status === "PAID" || p.status === "PDC_CLEARED")
      .reduce((s, p) => s + p.amount, 0);
    const totalDue = d.payments.filter((p) => p.status !== "CANCELLED")
      .reduce((s, p) => s + p.amount, 0);
    return {
      dealNumber:    d.dealNumber,
      buyer:         fullName(d.lead),
      unit:          d.unit.unitNumber,
      reservedOn:    d.reservationDate ? new Date(d.reservationDate) : null,
      stage:         d.stage,
      salePrice:     d.salePrice,
      discount:      d.discount,
      dldFee:        d.dldFee,
      adminFee:      d.adminFee,
      netValue:      d.salePrice - (d.discount ?? 0),
      collected,
      outstanding:   Math.max(0, totalDue - collected),
      collectionPct: totalDue > 0 ? collected / totalDue : 0,
      commissionStatus: d.commission?.status ?? "N/A",
    };
  });

  const after = addDataTable(sheet, startRow, [
    { header: "Deal #",        key: "dealNumber",       width: 16, type: "text" },
    { header: "Buyer",         key: "buyer",            width: 24, type: "text" },
    { header: "Unit",          key: "unit",             width: 12, type: "text" },
    { header: "Reserved",      key: "reservedOn",       width: 14, type: "date" },
    { header: "Stage",         key: "stage",            width: 22, type: "text" },
    { header: "Sale Price",    key: "salePrice",        width: 16, type: "currency", total: true },
    { header: "Discount",      key: "discount",         width: 14, type: "currency", total: true },
    { header: "DLD Fee",       key: "dldFee",           width: 12, type: "currency", total: true },
    { header: "Admin Fee",     key: "adminFee",         width: 12, type: "currency", total: true },
    { header: "Net Value",     key: "netValue",         width: 16, type: "currency", total: true },
    { header: "Collected",     key: "collected",        width: 16, type: "currency", total: true },
    { header: "Outstanding",   key: "outstanding",      width: 16, type: "currency", total: true },
    { header: "Collection %",  key: "collectionPct",    width: 13, type: "percent" },
    { header: "Commission",    key: "commissionStatus", width: 18, type: "text" },
  ], rows);

  // Stage conditional fill
  rows.forEach((_, i) => {
    const r = sheet.getRow(startRow + 1 + i);
    const stageCell = r.getCell(5);
    const v = String(stageCell.value);
    if (v === "COMPLETED") stageCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.positive } };
    else if (v === "CANCELLED") stageCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.negative } };
  });

  const completed = rows.filter((r) => r.stage === "COMPLETED").length;
  addSummaryBlock(sheet, after, "Summary", [
    { label: "Total Deals",      value: rows.length, type: "number" },
    { label: "Completed",        value: completed,   type: "number" },
    { label: "Completion Rate",  value: rows.length ? completed / rows.length : 0, type: "percent" },
    { label: "Total Net Value",  value: rows.reduce((s, r) => s + r.netValue, 0), type: "currency" },
    { label: "Total Collected",  value: rows.reduce((s, r) => s + r.collected, 0), type: "currency" },
    { label: "Total Outstanding",value: rows.reduce((s, r) => s + r.outstanding, 0), type: "currency" },
  ]);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

// ─── New generators ──────────────────────────────────────────────────────────

/** Monthly Revenue — last 12 months collected vs expected */
export async function generateRevenueReport(
  filters?: { startDate?: Date; endDate?: Date }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Samha CRM";

  const now = filters?.endDate ?? new Date();
  const start = filters?.startDate ?? new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const months: { key: string; label: string; collected: number; expected: number; collectionRate: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= now) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: cursor.toLocaleDateString("en-AE", { month: "short", year: "numeric" }),
      collected: 0,
      expected: 0,
      collectionRate: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const [paid, allDue] = await Promise.all([
    prisma.payment.findMany({
      where: { status: { in: ["PAID", "PDC_CLEARED"] }, paidDate: { not: null } },
      select: { amount: true, paidDate: true },
    }),
    prisma.payment.findMany({
      where: { status: { notIn: ["CANCELLED"] } },
      select: { amount: true, dueDate: true },
    }),
  ]);

  paid.forEach((p) => {
    if (!p.paidDate) return;
    const k = `${p.paidDate.getFullYear()}-${String(p.paidDate.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === k);
    if (m) m.collected += p.amount;
  });
  allDue.forEach((p) => {
    const k = `${p.dueDate.getFullYear()}-${String(p.dueDate.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === k);
    if (m) m.expected += p.amount;
  });
  months.forEach((m) => { m.collectionRate = m.expected > 0 ? m.collected / m.expected : 0; });

  const { sheet, startRow } = createReportSheet(workbook, "Revenue", {
    title: "Monthly Revenue Report",
    subtitle: "Collected vs. expected payments by month",
    filters: {
      From: start.toLocaleDateString("en-AE"),
      To:   now.toLocaleDateString("en-AE"),
    },
  });

  const after = addDataTable(sheet, startRow, [
    { header: "Month",           key: "label",          width: 16, type: "text" },
    { header: "Collected",       key: "collected",      width: 18, type: "currency", total: true },
    { header: "Expected",        key: "expected",       width: 18, type: "currency", total: true },
    { header: "Variance",        key: "variance",       width: 18, type: "currency", total: true },
    { header: "Collection Rate", key: "collectionRate", width: 16, type: "percent" },
  ], months.map((m) => ({ ...m, variance: m.collected - m.expected })));

  const totalCollected = months.reduce((s, m) => s + m.collected, 0);
  const totalExpected  = months.reduce((s, m) => s + m.expected, 0);
  addSummaryBlock(sheet, after, "Summary", [
    { label: "Total Collected",       value: totalCollected, type: "currency" },
    { label: "Total Expected",        value: totalExpected,  type: "currency" },
    { label: "Overall Collection %",  value: totalExpected > 0 ? totalCollected / totalExpected : 0, type: "percent" },
    { label: "Best Month (Collected)", value: months.reduce((b, m) => m.collected > b.collected ? m : b, months[0])?.label ?? "—" },
  ]);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/** Inventory by Project & Status */
export async function generateInventoryReport(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Samha CRM";

  const projects = await prisma.project.findMany({
    select: { id: true, name: true, units: { select: { status: true, price: true } } },
    orderBy: { name: "asc" },
  });

  const { sheet, startRow } = createReportSheet(workbook, "Inventory", {
    title: "Inventory Report",
    subtitle: "Units by project & status, with availability and total value",
  });

  const rows = projects.map((p) => {
    const c: Record<string, number> = {};
    let value = 0;
    p.units.forEach((u) => { c[u.status] = (c[u.status] || 0) + 1; value += u.price; });
    const total = p.units.length;
    return {
      project: p.name,
      total,
      available: c.AVAILABLE ?? 0,
      reserved:  c.RESERVED ?? 0,
      booked:    c.BOOKED ?? 0,
      sold:      c.SOLD ?? 0,
      handed:    c.HANDED_OVER ?? 0,
      blocked:   c.BLOCKED ?? 0,
      notReleased: c.NOT_RELEASED ?? 0,
      availability: total > 0 ? (c.AVAILABLE ?? 0) / total : 0,
      totalValue: value,
    };
  });

  const after = addDataTable(sheet, startRow, [
    { header: "Project",      key: "project",     width: 28, type: "text" },
    { header: "Total",        key: "total",       width: 10, type: "number", total: true },
    { header: "Available",    key: "available",   width: 12, type: "number", total: true },
    { header: "Reserved",     key: "reserved",    width: 12, type: "number", total: true },
    { header: "Booked",       key: "booked",      width: 12, type: "number", total: true },
    { header: "Sold",         key: "sold",        width: 12, type: "number", total: true },
    { header: "Handed Over",  key: "handed",      width: 13, type: "number", total: true },
    { header: "Blocked",      key: "blocked",     width: 12, type: "number", total: true },
    { header: "Not Released", key: "notReleased", width: 14, type: "number", total: true },
    { header: "Availability", key: "availability",width: 14, type: "percent" },
    { header: "Total Value",  key: "totalValue",  width: 20, type: "currency", total: true },
  ], rows);

  const totalUnits = rows.reduce((s, r) => s + r.total, 0);
  const totalAvail = rows.reduce((s, r) => s + r.available, 0);
  addSummaryBlock(sheet, after, "Summary", [
    { label: "Projects",        value: rows.length,       type: "number" },
    { label: "Total Units",     value: totalUnits,        type: "number" },
    { label: "Available Units", value: totalAvail,        type: "number" },
    { label: "Availability %",  value: totalUnits > 0 ? totalAvail / totalUnits : 0, type: "percent" },
    { label: "Portfolio Value", value: rows.reduce((s, r) => s + r.totalValue, 0), type: "currency" },
  ]);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/** Agent Performance — leads, deals, close rate, revenue, commission */
export async function generateAgentReport(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Samha CRM";

  const agents = await prisma.user.findMany({
    where: { role: { in: ["SALES_AGENT", "ADMIN"] } },
    select: {
      id: true, name: true, role: true,
      assignedLeads: { select: { id: true, stage: true } },
      _count: { select: { assignedLeads: true } },
    },
  });

  const allLeads = await prisma.lead.findMany({
    select: { id: true, stage: true, assignedAgentId: true },
  });
  const leadAgent = new Map(allLeads.map((l) => [l.id, l.assignedAgentId]));

  const allDeals = await prisma.deal.findMany({ select: { salePrice: true, leadId: true } });
  const allComms = await prisma.commission.findMany({
    where: { status: "PAID" },
    include: { deal: { select: { leadId: true } } },
  });

  const dealMap = new Map<string, { count: number; revenue: number }>();
  for (const d of allDeals) {
    const uid = leadAgent.get(d.leadId);
    if (!uid) continue;
    const e = dealMap.get(uid) ?? { count: 0, revenue: 0 };
    e.count++;
    e.revenue += d.salePrice ?? 0;
    dealMap.set(uid, e);
  }
  const commMap = new Map<string, number>();
  for (const c of allComms) {
    const uid = leadAgent.get(c.deal?.leadId ?? "");
    if (!uid) continue;
    commMap.set(uid, (commMap.get(uid) ?? 0) + (c.amount ?? 0));
  }

  const rows = agents.map((a) => {
    const closed = a.assignedLeads.filter((l) => l.stage === "CLOSED_WON").length;
    const d = dealMap.get(a.id);
    return {
      agent: a.name,
      role:  a.role.replace(/_/g, " "),
      leads: a._count.assignedLeads,
      closedLeads: closed,
      closeRate: a._count.assignedLeads > 0 ? closed / a._count.assignedLeads : 0,
      deals: d?.count ?? 0,
      revenue: d?.revenue ?? 0,
      commission: commMap.get(a.id) ?? 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const { sheet, startRow } = createReportSheet(workbook, "Agents", {
    title: "Agent Performance Report",
    subtitle: "Leads, deals, conversion, revenue, and earned commission",
  });

  const after = addDataTable(sheet, startRow, [
    { header: "Agent",         key: "agent",       width: 26, type: "text" },
    { header: "Role",          key: "role",        width: 16, type: "text" },
    { header: "Leads",         key: "leads",       width: 10, type: "number", total: true },
    { header: "Closed Leads",  key: "closedLeads", width: 14, type: "number", total: true },
    { header: "Close Rate",    key: "closeRate",   width: 12, type: "percent" },
    { header: "Deals",         key: "deals",       width: 10, type: "number", total: true },
    { header: "Revenue",       key: "revenue",     width: 18, type: "currency", total: true },
    { header: "Commission",    key: "commission",  width: 18, type: "currency", total: true },
  ], rows);

  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalClosed = rows.reduce((s, r) => s + r.closedLeads, 0);
  addSummaryBlock(sheet, after, "Summary", [
    { label: "Agents",          value: rows.length, type: "number" },
    { label: "Total Leads",     value: totalLeads, type: "number" },
    { label: "Closed Leads",    value: totalClosed, type: "number" },
    { label: "Avg Close Rate",  value: totalLeads > 0 ? totalClosed / totalLeads : 0, type: "percent" },
    { label: "Total Revenue",   value: rows.reduce((s, r) => s + r.revenue, 0), type: "currency" },
    { label: "Total Commission",value: rows.reduce((s, r) => s + r.commission, 0), type: "currency" },
  ]);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/** Collections — overdue + aging + upcoming */
export async function generateCollectionsReport(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Samha CRM";

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const [overdue, upcoming] = await Promise.all([
    prisma.payment.findMany({
      where: { status: { in: ["OVERDUE", "PARTIAL"] }, dueDate: { lt: now } },
      include: { deal: { include: { lead: true, unit: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.payment.findMany({
      where: { status: "PENDING", dueDate: { gte: now, lte: in30 } },
      include: { deal: { include: { lead: true, unit: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const { sheet, startRow } = createReportSheet(workbook, "Overdue", {
    title: "Collections Report",
    subtitle: "Overdue payments with aging buckets, plus upcoming dues",
    filters: { "As of": now.toLocaleDateString("en-AE") },
  });

  const overdueRows = overdue.map((p) => {
    const days = Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 86400000);
    const bucket = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
    return {
      dealNumber: p.deal?.dealNumber ?? "",
      buyer:      fullName(p.deal?.lead),
      unit:       p.deal?.unit?.unitNumber ?? "",
      milestone:  p.milestoneLabel,
      dueDate:    new Date(p.dueDate),
      daysLate:   days,
      bucket,
      amount:     p.amount,
      status:     p.status,
    };
  });

  const after1 = addDataTable(sheet, startRow, [
    { header: "Deal #",     key: "dealNumber", width: 16, type: "text" },
    { header: "Buyer",      key: "buyer",      width: 24, type: "text" },
    { header: "Unit",       key: "unit",       width: 12, type: "text" },
    { header: "Milestone",  key: "milestone",  width: 28, type: "text" },
    { header: "Due Date",   key: "dueDate",    width: 14, type: "date" },
    { header: "Days Late",  key: "daysLate",   width: 12, type: "number" },
    { header: "Aging",      key: "bucket",     width: 10, type: "text" },
    { header: "Amount",     key: "amount",     width: 18, type: "currency", total: true },
    { header: "Status",     key: "status",     width: 14, type: "text" },
  ], overdueRows);

  // Color code aging cells
  overdueRows.forEach((r, i) => {
    const cell = sheet.getRow(startRow + 1 + i).getCell(7);
    let fg = BRAND.warning;
    if (r.bucket === "31-60") fg = "FFFFE4B5";
    else if (r.bucket === "61-90") fg = BRAND.negative;
    else if (r.bucket === "90+") fg = "FFF87171";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fg } };
    cell.font = { bold: true };
  });

  // Aging summary
  const aging: Record<string, { count: number; amount: number }> = {
    "0-30": { count: 0, amount: 0 }, "31-60": { count: 0, amount: 0 },
    "61-90": { count: 0, amount: 0 }, "90+":  { count: 0, amount: 0 },
  };
  overdueRows.forEach((r) => { aging[r.bucket].count++; aging[r.bucket].amount += r.amount; });

  const after2 = addSummaryBlock(sheet, after1, "Aging Summary", [
    { label: "0–30 days  (count / amount)", value: `${aging["0-30"].count}  /  AED ${aging["0-30"].amount.toLocaleString()}` },
    { label: "31–60 days (count / amount)", value: `${aging["31-60"].count}  /  AED ${aging["31-60"].amount.toLocaleString()}` },
    { label: "61–90 days (count / amount)", value: `${aging["61-90"].count}  /  AED ${aging["61-90"].amount.toLocaleString()}` },
    { label: "90+ days   (count / amount)", value: `${aging["90+"].count}  /  AED ${aging["90+"].amount.toLocaleString()}` },
    { label: "TOTAL OVERDUE",               value: overdueRows.reduce((s, r) => s + r.amount, 0), type: "currency" },
  ]);

  // Upcoming sub-section
  const upTitle = sheet.getCell(`A${after2}`);
  upTitle.value = "Upcoming Dues — Next 30 Days";
  upTitle.font = { bold: true, size: 12 };

  const upcomingRows = upcoming.map((p) => ({
    dealNumber: p.deal?.dealNumber ?? "",
    buyer:      fullName(p.deal?.lead),
    unit:       p.deal?.unit?.unitNumber ?? "",
    milestone:  p.milestoneLabel,
    dueDate:    new Date(p.dueDate),
    daysOut:    Math.ceil((new Date(p.dueDate).getTime() - now.getTime()) / 86400000),
    amount:     p.amount,
  }));

  addDataTable(sheet, after2 + 1, [
    { header: "Deal #",     key: "dealNumber", width: 16, type: "text" },
    { header: "Buyer",      key: "buyer",      width: 24, type: "text" },
    { header: "Unit",       key: "unit",       width: 12, type: "text" },
    { header: "Milestone",  key: "milestone",  width: 28, type: "text" },
    { header: "Due Date",   key: "dueDate",    width: 14, type: "date" },
    { header: "Days Out",   key: "daysOut",    width: 12, type: "number" },
    { header: "Amount",     key: "amount",     width: 18, type: "currency", total: true },
  ], upcomingRows, { freezeHeader: false });

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/** Full Payments register */
export async function generatePaymentsReport(
  filters?: { status?: string; startDate?: Date; endDate?: Date }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Samha CRM";

  const where: any = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.startDate || filters?.endDate) {
    where.dueDate = {};
    if (filters.startDate) where.dueDate.gte = filters.startDate;
    if (filters.endDate) where.dueDate.lte = filters.endDate;
  }

  const payments = await prisma.payment.findMany({
    where,
    include: { deal: { include: { lead: true, unit: true } } },
    orderBy: { dueDate: "asc" },
  });

  const { sheet, startRow } = createReportSheet(workbook, "Payments", {
    title: "Payments Register",
    subtitle: "All payments with milestone, status, and timing",
    filters: {
      Status: filters?.status ?? "All",
      From:   filters?.startDate ? filters.startDate.toLocaleDateString("en-AE") : "—",
      To:     filters?.endDate   ? filters.endDate.toLocaleDateString("en-AE")   : "—",
    },
  });

  const rows = payments.map((p) => ({
    dealNumber: p.deal?.dealNumber ?? "",
    buyer:      fullName(p.deal?.lead),
    unit:       p.deal?.unit?.unitNumber ?? "",
    milestone:  p.milestoneLabel,
    dueDate:    new Date(p.dueDate),
    paidDate:   p.paidDate ? new Date(p.paidDate) : null,
    amount:     p.amount,
    method:     p.paymentMethod ?? "",
    status:     p.status,
  }));

  addDataTable(sheet, startRow, [
    { header: "Deal #",     key: "dealNumber", width: 16, type: "text" },
    { header: "Buyer",      key: "buyer",      width: 24, type: "text" },
    { header: "Unit",       key: "unit",       width: 12, type: "text" },
    { header: "Milestone",  key: "milestone",  width: 28, type: "text" },
    { header: "Due Date",   key: "dueDate",    width: 14, type: "date" },
    { header: "Paid Date",  key: "paidDate",   width: 14, type: "date" },
    { header: "Amount",     key: "amount",     width: 18, type: "currency", total: true },
    { header: "Method",     key: "method",     width: 14, type: "text" },
    { header: "Status",     key: "status",     width: 14, type: "text" },
  ], rows);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/** Leads pipeline */
export async function generateLeadsReport(
  filters?: { stage?: string; source?: string; startDate?: Date; endDate?: Date }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Samha CRM";

  const where: any = {};
  if (filters?.stage) where.stage = filters.stage;
  if (filters?.source) where.source = filters.source;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { assignedAgent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const { sheet, startRow } = createReportSheet(workbook, "Leads", {
    title: "Leads Report",
    subtitle: "Lead pipeline with assigned agent, stage, and source",
    filters: {
      Stage:  filters?.stage ?? "All",
      Source: filters?.source ?? "All",
      From:   filters?.startDate ? filters.startDate.toLocaleDateString("en-AE") : "—",
      To:     filters?.endDate   ? filters.endDate.toLocaleDateString("en-AE")   : "—",
    },
  });

  const rows = leads.map((l) => ({
    name:    fullName(l),
    email:   l.email ?? "",
    phone:   l.phone ?? "",
    stage:   l.stage,
    source:  l.source,
    agent:   l.assignedAgent?.name ?? "—",
    createdAt: new Date(l.createdAt),
  }));

  addDataTable(sheet, startRow, [
    { header: "Lead",       key: "name",      width: 26, type: "text" },
    { header: "Email",      key: "email",     width: 28, type: "text" },
    { header: "Phone",      key: "phone",     width: 18, type: "text" },
    { header: "Stage",      key: "stage",     width: 18, type: "text" },
    { header: "Source",     key: "source",    width: 16, type: "text" },
    { header: "Agent",      key: "agent",     width: 22, type: "text" },
    { header: "Created",    key: "createdAt", width: 14, type: "date" },
  ], rows);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}
