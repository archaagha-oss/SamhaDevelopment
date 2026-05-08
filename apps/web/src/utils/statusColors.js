// Status color system - consistent across the app
export const STATUS_COLORS = {
    NOT_RELEASED: {
        bg: "bg-slate-50",
        text: "text-slate-700",
        badge: "bg-slate-100 text-slate-800",
        dot: "bg-slate-400",
    },
    AVAILABLE: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        badge: "bg-emerald-100 text-emerald-800",
        dot: "bg-emerald-500",
    },
    ON_HOLD: {
        bg: "bg-orange-50",
        text: "text-orange-700",
        badge: "bg-orange-100 text-orange-800",
        dot: "bg-orange-500",
    },
    RESERVED: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        badge: "bg-amber-100 text-amber-800",
        dot: "bg-amber-500",
    },
    BOOKED: {
        bg: "bg-sky-50",
        text: "text-sky-700",
        badge: "bg-sky-100 text-sky-800",
        dot: "bg-sky-500",
    },
    SOLD: {
        bg: "bg-rose-50",
        text: "text-rose-700",
        badge: "bg-rose-100 text-rose-800",
        dot: "bg-rose-400",
    },
    HANDED_OVER: {
        bg: "bg-teal-50",
        text: "text-teal-700",
        badge: "bg-teal-100 text-teal-800",
        dot: "bg-teal-500",
    },
    BLOCKED: {
        bg: "bg-slate-100",
        text: "text-slate-600",
        badge: "bg-slate-200 text-slate-700",
        dot: "bg-slate-400",
    },
};
export const PAYMENT_STATUS_COLORS = {
    PAID: { bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
    PARTIAL: { bg: "bg-sky-50", text: "text-sky-700", badge: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
    PDC: { bg: "bg-violet-50", text: "text-violet-700", badge: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
    PENDING: { bg: "bg-slate-50", text: "text-slate-700", badge: "bg-slate-100 text-slate-800", dot: "bg-slate-400" },
    OVERDUE: { bg: "bg-rose-50", text: "text-rose-700", badge: "bg-rose-100 text-rose-800", dot: "bg-rose-500" },
    WAIVED: { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
};
export function getPaymentStatusColor(status) {
    return PAYMENT_STATUS_COLORS[status] || PAYMENT_STATUS_COLORS.PENDING;
}
export const BROKER_STATUS_COLORS = {
    ACTIVE: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
    INACTIVE: { badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
    PENDING_APPROVAL: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
};
export function getBrokerStatusColor(status) {
    return BROKER_STATUS_COLORS[status] || BROKER_STATUS_COLORS.PENDING_APPROVAL;
}
export function getStatusColor(status) {
    return STATUS_COLORS[status] || STATUS_COLORS.NOT_RELEASED;
}
