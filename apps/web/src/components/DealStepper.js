import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STEPS = [
    { stage: "RESERVATION_PENDING", label: "Reservation" },
    { stage: "RESERVATION_CONFIRMED", label: "Reserved" },
    { stage: "SPA_PENDING", label: "SPA Drafted" },
    { stage: "SPA_SENT", label: "SPA Sent" },
    { stage: "SPA_SIGNED", label: "SPA Signed" },
    { stage: "OQOOD_PENDING", label: "Oqood Filed" },
    { stage: "OQOOD_REGISTERED", label: "Oqood Registered" },
    { stage: "INSTALLMENTS_ACTIVE", label: "Installments" },
    { stage: "HANDOVER_PENDING", label: "Handover" },
    { stage: "COMPLETED", label: "Completed" },
];
export default function DealStepper({ current, cancelled = false }) {
    const currentIndex = STEPS.findIndex((s) => s.stage === current);
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Deal Progress" }), _jsx("span", { className: "text-[11px] text-slate-400", children: cancelled ? "Cancelled" : `${Math.max(currentIndex, 0) + 1} of ${STEPS.length}` })] }), _jsxs("div", { className: "space-y-0", children: [STEPS.map((s, i) => {
                        const done = !cancelled && i < currentIndex;
                        const active = !cancelled && i === currentIndex;
                        const dot = done
                            ? "bg-emerald-500 text-white"
                            : active
                                ? "bg-blue-600 text-white ring-4 ring-blue-100"
                                : "bg-slate-200 text-slate-400";
                        const labelCls = done
                            ? "text-slate-500"
                            : active
                                ? "text-slate-900 font-semibold"
                                : "text-slate-400";
                        return (_jsxs("div", { className: "flex items-start gap-3 relative", children: [i < STEPS.length - 1 && (_jsx("div", { className: `absolute left-3 top-6 w-0.5 h-[calc(100%-12px)] ${!cancelled && i < currentIndex ? "bg-emerald-300" : "bg-slate-200"}` })), _jsx("div", { className: `relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${dot}`, children: done ? "✓" : i + 1 }), _jsxs("div", { className: `flex-1 pb-3 text-sm ${labelCls}`, children: [s.label, active && !cancelled && (_jsx("span", { className: "ml-2 text-[10px] uppercase tracking-wider text-blue-500 font-bold", children: "Current" }))] })] }, s.stage));
                    }), cancelled && (_jsx("div", { className: "mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2", children: "This deal was cancelled." }))] })] }));
}
