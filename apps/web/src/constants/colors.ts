// Unified color system for deal statuses and UI elements
export const STATUS_COLORS = {
  // Deal statuses
  RESERVATION_PENDING: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", badge: "bg-slate-100 text-slate-600" },
  RESERVATION_CONFIRMED: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  SPA_PENDING: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
  SPA_SENT: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
  SPA_SIGNED: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-700" },
  OQOOD_PENDING: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" },
  OQOOD_REGISTERED: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", badge: "bg-teal-100 text-teal-700" },
  INSTALLMENTS_ACTIVE: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", badge: "bg-indigo-100 text-indigo-700" },
  HANDOVER_PENDING: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  COMPLETED: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-700" },

  // Payment statuses
  PAID: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  PDC_PENDING: "bg-orange-100 text-orange-700",
  PDC_CLEARED: "bg-teal-100 text-teal-700",

  // Unit statuses
  AVAILABLE: "bg-green-100 text-green-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  RESERVED: "bg-emerald-100 text-emerald-700",
  SOLD: "bg-red-100 text-red-700",

  // Alert levels
  SUCCESS: "text-emerald-600 bg-emerald-50 border-emerald-200",
  WARNING: "text-amber-600 bg-amber-50 border-amber-200",
  ERROR: "text-red-600 bg-red-50 border-red-200",
  INFO: "text-blue-600 bg-blue-50 border-blue-200",
} as const;

export const getStatusBadge = (status: string) => {
  return (STATUS_COLORS as any)[status] || "bg-slate-100 text-slate-600";
};

export const getStageColors = (stage: string) => {
  return (STATUS_COLORS as any)[stage] || { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", badge: "bg-slate-100 text-slate-600" };
};
