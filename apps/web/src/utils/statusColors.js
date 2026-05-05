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
        bg: "bg-blue-50",
        text: "text-blue-700",
        badge: "bg-blue-100 text-blue-800",
        dot: "bg-blue-500",
    },
    BOOKED: {
        bg: "bg-purple-50",
        text: "text-purple-700",
        badge: "bg-purple-100 text-purple-800",
        dot: "bg-purple-500",
    },
    SOLD: {
        bg: "bg-gray-50",
        text: "text-gray-700",
        badge: "bg-gray-100 text-gray-800",
        dot: "bg-gray-400",
    },
    HANDED_OVER: {
        bg: "bg-teal-50",
        text: "text-teal-700",
        badge: "bg-teal-100 text-teal-800",
        dot: "bg-teal-500",
    },
    BLOCKED: {
        bg: "bg-red-50",
        text: "text-red-700",
        badge: "bg-red-100 text-red-800",
        dot: "bg-red-500",
    },
};
export function getStatusColor(status) {
    return STATUS_COLORS[status] || STATUS_COLORS.NOT_RELEASED;
}
