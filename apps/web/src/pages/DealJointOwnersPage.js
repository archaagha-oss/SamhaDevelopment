import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams, Link } from "react-router-dom";
import JointOwnerEditor from "../components/JointOwnerEditor";
export default function DealJointOwnersPage() {
    const { dealId } = useParams();
    if (!dealId)
        return _jsx("div", { className: "p-6", children: "Deal ID required." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx(Link, { to: `/deals/${dealId}`, className: "text-sm text-blue-600 hover:underline", children: "\u2190 Back to deal" }), _jsx("h1", { className: "text-2xl font-semibold", children: "Joint Owners" }), _jsx(JointOwnerEditor, { dealId: dealId })] }));
}
