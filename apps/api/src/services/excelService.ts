import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";

/**
 * Generate Commission Statement Excel file
 * Shows all commissions for a broker company with status breakdown
 */
export async function generateCommissionStatement(
  brokerCompanyId: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Commission Statement");

  // Fetch commission data
  const commissions = await prisma.commission.findMany({
    where: { brokerCompanyId },
    include: {
      deal: {
        include: {
          lead: true,
          unit: true,
        },
      },
      brokerCompany: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const company = commissions[0]?.brokerCompany;

  // Header
  worksheet.columns = [
    { header: "Deal Number", key: "dealNumber", width: 15 },
    { header: "Lead Name", key: "leadName", width: 20 },
    { header: "Unit", key: "unit", width: 12 },
    { header: "Commission Rate", key: "rate", width: 15 },
    { header: "Commission Amount (AED)", key: "amount", width: 20 },
    { header: "Status", key: "status", width: 15 },
    { header: "Approval Date", key: "approvedDate", width: 15 },
    { header: "Paid Date", key: "paidDate", width: 15 },
    { header: "Paid Amount (AED)", key: "paidAmount", width: 18 },
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF366092" },
  };

  // Add company info
  let rowNum = 3;
  worksheet.getCell(`A${rowNum}`).font = { bold: true, size: 14 };
  worksheet.getCell(`A${rowNum}`).value = `${company?.name || "Broker"} - Commission Statement`;

  rowNum += 2;
  worksheet.getCell(`A${rowNum}`).value = `Generated: ${new Date().toLocaleDateString()}`;

  // Add data
  rowNum += 2;
  worksheet.getCell(`A${rowNum}`).value = "Deal Number";
  worksheet.getCell(`B${rowNum}`).value = "Lead Name";
  worksheet.getCell(`C${rowNum}`).value = "Unit";
  worksheet.getCell(`D${rowNum}`).value = "Rate %";
  worksheet.getCell(`E${rowNum}`).value = "Amount";
  worksheet.getCell(`F${rowNum}`).value = "Status";
  worksheet.getCell(`G${rowNum}`).value = "Approved";
  worksheet.getCell(`H${rowNum}`).value = "Paid Date";
  worksheet.getCell(`I${rowNum}`).value = "Paid Amount";

  // Style header row
  for (let i = 1; i <= 9; i++) {
    const cell = worksheet.getCell(`${String.fromCharCode(64 + i)}${rowNum}`);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF366092" },
    };
  }

  // Add commission rows
  let totalAmount = 0;
  let totalPaid = 0;

  commissions.forEach((commission) => {
    rowNum++;
    worksheet.getCell(`A${rowNum}`).value = commission.deal.dealNumber;
    worksheet.getCell(`B${rowNum}`).value = `${commission.deal.lead.firstName} ${commission.deal.lead.lastName}`;
    worksheet.getCell(`C${rowNum}`).value = commission.deal.unit.unitNumber;
    worksheet.getCell(`D${rowNum}`).value = commission.rate;
    worksheet.getCell(`E${rowNum}`).value = commission.amount;
    worksheet.getCell(`F${rowNum}`).value = commission.status;
    worksheet.getCell(`G${rowNum}`).value = commission.approvedDate
      ? new Date(commission.approvedDate).toLocaleDateString()
      : "";
    worksheet.getCell(`H${rowNum}`).value = commission.paidDate
      ? new Date(commission.paidDate).toLocaleDateString()
      : "";
    worksheet.getCell(`I${rowNum}`).value = commission.paidAmount || "";

    // Color code status
    const statusCell = worksheet.getCell(`F${rowNum}`);
    if (commission.status === "PAID") {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC6EFCE" },
      };
    } else if (commission.status === "PENDING_APPROVAL") {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFF00" },
      };
    }

    totalAmount += commission.amount;
    if (commission.paidAmount) totalPaid += commission.paidAmount;
  });

  // Summary
  rowNum += 2;
  worksheet.getCell(`D${rowNum}`).font = { bold: true };
  worksheet.getCell(`D${rowNum}`).value = "Total Commission:";
  worksheet.getCell(`E${rowNum}`).font = { bold: true };
  worksheet.getCell(`E${rowNum}`).value = totalAmount;

  rowNum++;
  worksheet.getCell(`D${rowNum}`).font = { bold: true };
  worksheet.getCell(`D${rowNum}`).value = "Total Paid:";
  worksheet.getCell(`E${rowNum}`).font = { bold: true };
  worksheet.getCell(`E${rowNum}`).value = totalPaid;

  rowNum++;
  worksheet.getCell(`D${rowNum}`).font = { bold: true };
  worksheet.getCell(`D${rowNum}`).value = "Pending:";
  worksheet.getCell(`E${rowNum}`).font = { bold: true };
  worksheet.getCell(`E${rowNum}`).value = totalAmount - totalPaid;

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/**
 * Generate Deal Report Excel file
 * Shows all deals with financial summary
 */
export async function generateDealReport(
  filters?: { stage?: string; startDate?: Date; endDate?: Date }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Deal Report");

  // Fetch deal data
  const where: any = {};
  if (filters?.stage) where.stage = filters.stage;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      lead: true,
      unit: true,
      payments: true,
      commission: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Header
  worksheet.columns = [
    { header: "Deal Number", key: "dealNumber", width: 15 },
    { header: "Lead", key: "lead", width: 20 },
    { header: "Unit", key: "unit", width: 12 },
    { header: "Sale Price", key: "salePrice", width: 15 },
    { header: "Discount", key: "discount", width: 12 },
    { header: "DLD Fee", key: "dldFee", width: 12 },
    { header: "Admin Fee", key: "adminFee", width: 12 },
    { header: "Total Value", key: "totalValue", width: 15 },
    { header: "Stage", key: "stage", width: 20 },
    { header: "Payments Received", key: "paymentReceived", width: 18 },
    { header: "Commission Status", key: "commissionStatus", width: 15 },
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF366092" },
  };

  // Add data
  let totalRevenue = 0;
  let totalFees = 0;
  let totalCommissions = 0;
  let completedDeals = 0;

  deals.forEach((deal, index) => {
    const row = worksheet.addRow({
      dealNumber: deal.dealNumber,
      lead: `${deal.lead.firstName} ${deal.lead.lastName}`,
      unit: deal.unit.unitNumber,
      salePrice: deal.salePrice,
      discount: deal.discount,
      dldFee: deal.dldFee,
      adminFee: deal.adminFee,
      totalValue: deal.salePrice - deal.discount + deal.dldFee + deal.adminFee,
      stage: deal.stage,
      paymentReceived: deal.payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + p.amount, 0),
      commissionStatus: deal.commission?.status || "N/A",
    });

    // Color code stage
    const stageCell = row.getCell("stage");
    if (deal.stage === "COMPLETED") {
      stageCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC6EFCE" },
      };
      completedDeals++;
    } else if (deal.stage === "CANCELLED") {
      stageCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8CBAD" },
      };
    }

    totalRevenue += deal.salePrice;
    totalFees += deal.dldFee + deal.adminFee;
    if (deal.commission) totalCommissions += deal.commission.amount;
  });

  // Summary section
  const summaryRow = worksheet.addRow([]);
  summaryRow.height = 20;

  const summaryStartRow = deals.length + 3;
  worksheet.getCell(`A${summaryStartRow}`).font = { bold: true, size: 12 };
  worksheet.getCell(`A${summaryStartRow}`).value = "SUMMARY";

  worksheet.getCell(`A${summaryStartRow + 2}`).value = "Total Deals:";
  worksheet.getCell(`B${summaryStartRow + 2}`).value = deals.length;

  worksheet.getCell(`A${summaryStartRow + 3}`).value = "Completed:";
  worksheet.getCell(`B${summaryStartRow + 3}`).value = completedDeals;

  worksheet.getCell(`A${summaryStartRow + 4}`).value = "Total Revenue:";
  worksheet.getCell(`B${summaryStartRow + 4}`).value = totalRevenue;

  worksheet.getCell(`A${summaryStartRow + 5}`).value = "Total Fees:";
  worksheet.getCell(`B${summaryStartRow + 5}`).value = totalFees;

  worksheet.getCell(`A${summaryStartRow + 6}`).value = "Total Commissions:";
  worksheet.getCell(`B${summaryStartRow + 6}`).value = totalCommissions;

  worksheet.getCell(`A${summaryStartRow + 7}`).value = "Completion Rate:";
  worksheet.getCell(`B${summaryStartRow + 7}`).value = `${((completedDeals / deals.length) * 100).toFixed(1)}%`;

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}
