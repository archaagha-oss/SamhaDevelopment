import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams, Link } from "react-router-dom";
import LeadKycTab from "../components/LeadKycTab";
export default function LeadKycPage() {
    const { leadId } = useParams();
    if (!leadId)
        return _jsx("div", { className: "p-6", children: "Lead ID required." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx(Link, { to: `/leads/${leadId}`, className: "text-sm text-blue-600 hover:underline", children: "\u2190 Back to lead" }), _jsx("h1", { className: "text-2xl font-semibold", children: "Lead KYC" }), _jsx(LeadKycTab, { leadId: leadId })] }));
}
