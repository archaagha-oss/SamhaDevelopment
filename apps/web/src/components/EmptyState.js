import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from "@/components/ui/button";
export default function EmptyState({ icon = "📭", title, description, action }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 px-6 text-center", children: [_jsx("div", { className: "text-4xl mb-3 opacity-50", children: icon }), _jsx("h3", { className: "text-sm font-semibold text-foreground mb-1", children: title }), description && (_jsx("p", { className: "text-xs text-muted-foreground max-w-xs leading-relaxed", children: description })), action && (_jsx(Button, { onClick: action.onClick, className: "mt-4", size: "sm", children: action.label }))] }));
}
