import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BrokerPerformanceTable - Broker agent collection metrics
 * Shows performance ranking by collection rate, deals, and payment days
 *
 * Features:
 * - Sortable ranking
 * - Color-coded performance bars
 * - Deal count and earnings
 * - Average payment days indicator
 */
export default function BrokerPerformanceTable({ data, loading = false, }) {
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center py-8", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    if (data.length === 0) {
        return (_jsx("div", { className: "text-center py-8 text-slate-600", children: _jsx("p", { children: "No broker data available" }) }));
    }
    return (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200", children: [_jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-900", children: "Broker" }), _jsx("th", { className: "text-center px-4 py-3 font-semibold text-slate-900", children: "Deals" }), _jsx("th", { className: "text-right px-4 py-3 font-semibold text-slate-900", children: "Total Sale" }), _jsx("th", { className: "text-right px-4 py-3 font-semibold text-slate-900", children: "Collected" }), _jsx("th", { className: "text-center px-4 py-3 font-semibold text-slate-900", children: "Collection %" }), _jsx("th", { className: "text-center px-4 py-3 font-semibold text-slate-900", children: "Avg Days" })] }) }), _jsx("tbody", { children: data.map((broker, index) => {
                            const collectionRate = parseFloat(broker.collectionRate);
                            const isAboveAverage = collectionRate > 85;
                            return (_jsxs("tr", { className: `border-b border-slate-200 transition ${index % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-blue-50`, children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { children: [_jsxs("p", { className: "font-semibold text-slate-900", children: ["#", index + 1, " ", broker.brokerName] }), _jsx("p", { className: "text-xs text-slate-500", children: broker.brokerId })] }) }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsx("span", { className: "inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded font-semibold text-xs", children: broker.dealCount }) }), _jsxs("td", { className: "px-4 py-3 text-right font-semibold text-slate-900", children: ["AED ", (broker.totalSalePrice / 1000000).toFixed(1), "M"] }), _jsxs("td", { className: "px-4 py-3 text-right font-semibold text-emerald-700", children: ["AED ", (broker.collectionAmount / 1000000).toFixed(1), "M"] }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 max-w-xs bg-slate-200 rounded-full h-2 overflow-hidden", children: _jsx("div", { className: `h-full rounded-full transition-all ${isAboveAverage ? "bg-emerald-500" : "bg-amber-500"}`, style: { width: `${collectionRate}%` } }) }), _jsxs("span", { className: `font-semibold text-xs whitespace-nowrap ${isAboveAverage ? "text-emerald-700" : "text-amber-700"}`, children: [broker.collectionRate, "%"] })] }) }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsxs("span", { className: `inline-block px-2 py-1 rounded text-xs font-semibold ${broker.avgPaymentDays <= 20
                                                ? "bg-emerald-100 text-emerald-700"
                                                : broker.avgPaymentDays <= 30
                                                    ? "bg-amber-100 text-amber-700"
                                                    : "bg-red-100 text-red-700"}`, children: [broker.avgPaymentDays, "d"] }) })] }, broker.brokerId));
                        }) })] }), _jsxs("div", { className: "border-t border-slate-200 pt-4 mt-4 grid grid-cols-3 gap-3 text-center", children: [_jsxs("div", { className: "bg-slate-50 rounded p-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Total Brokers" }), _jsx("p", { className: "text-lg font-bold text-slate-900", children: data.length })] }), _jsxs("div", { className: "bg-slate-50 rounded p-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Avg Collection %" }), _jsxs("p", { className: "text-lg font-bold text-slate-900", children: [(data.reduce((sum, b) => sum + parseFloat(b.collectionRate), 0) / data.length).toFixed(1), "%"] })] }), _jsxs("div", { className: "bg-slate-50 rounded p-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Top Performer" }), _jsx("p", { className: "text-lg font-bold text-emerald-700", children: data[0]?.brokerName.split(" ")[0] })] })] })] }));
}
