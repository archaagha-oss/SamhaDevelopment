import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "danger", onConfirm, onCancel, }) {
    const confirmVariant = variant === "danger"
        ? "destructive"
        : variant === "warning"
            ? "default"
            : "default";
    return (_jsx(Dialog, { open: open, onOpenChange: (o) => { if (!o)
            onCancel(); }, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), _jsx(DialogDescription, { className: "leading-relaxed", children: message })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: onCancel, children: cancelLabel }), _jsx(Button, { variant: confirmVariant, onClick: onConfirm, children: confirmLabel })] })] }) }));
}
