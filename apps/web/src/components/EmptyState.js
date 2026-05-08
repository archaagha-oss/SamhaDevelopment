import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from "@/components/ui/button";
export default function EmptyState({ icon = "📭", title, description, actionLabel, onAction, action, variant = "default", }) {
    if (variant === "compact") {
        return (_jsx("div", { className: "text-center py-4", children: _jsx("p", { className: "text-slate-400 text-sm", children: title }) }));
    }
    const label = actionLabel ?? action?.label;
    const handler = onAction ?? action?.onClick;
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 px-6 text-center", children: [_jsx("div", { className: "text-4xl mb-3 opacity-50", children: icon }), _jsx("h3", { className: "text-sm font-semibold text-foreground mb-1", children: title }), description && (_jsx("p", { className: "text-xs text-muted-foreground max-w-xs leading-relaxed", children: description })), label && handler && (_jsx(Button, { onClick: handler, className: "mt-4", size: "sm", children: label }))] }));
}
