import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
export default function RequireAuth({ children, roles }) {
    const { user, status } = useAuth();
    const location = useLocation();
    if (status === "loading") {
        return (_jsx("div", { className: "flex h-screen items-center justify-center text-gray-500", children: "Loading\u2026" }));
    }
    if (status === "anonymous" || !user) {
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: location } });
    }
    if (roles && !roles.includes(user.role)) {
        return (_jsxs("div", { className: "flex h-screen flex-col items-center justify-center text-center", children: [_jsx("h1", { className: "text-2xl font-semibold text-gray-900", children: "Access denied" }), _jsx("p", { className: "mt-2 text-gray-600", children: "You do not have permission to view this page." })] }));
    }
    return _jsx(_Fragment, { children: children });
}
