import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
export default function ChangePasswordPage() {
    const { user, changePassword, logout } = useAuth();
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [submitting, setSubmitting] = useState(false);
    async function onSubmit(e) {
        e.preventDefault();
        if (newPassword !== confirm) {
            toast.error("New password and confirmation do not match");
            return;
        }
        setSubmitting(true);
        try {
            await changePassword(currentPassword, newPassword);
            toast.success("Password updated");
            navigate("/", { replace: true });
        }
        catch (err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toast.error(err?.response?.data?.error || "Failed to update password");
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-gray-50 px-4", children: _jsxs("form", { onSubmit: onSubmit, className: "w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm", children: [_jsx("h1", { className: "text-xl font-semibold text-gray-900", children: "Change your password" }), _jsx("p", { className: "mt-1 text-sm text-gray-500", children: user?.mustChangePassword
                        ? "You must set a new password before continuing."
                        : "Pick a new password." }), _jsx("label", { className: "mt-6 block text-sm font-medium text-gray-700", children: "Current password" }), _jsx("input", { type: "password", required: true, autoComplete: "current-password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), className: "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" }), _jsx("label", { className: "mt-4 block text-sm font-medium text-gray-700", children: "New password" }), _jsx("input", { type: "password", required: true, minLength: 8, autoComplete: "new-password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), className: "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" }), _jsx("label", { className: "mt-4 block text-sm font-medium text-gray-700", children: "Confirm new password" }), _jsx("input", { type: "password", required: true, minLength: 8, autoComplete: "new-password", value: confirm, onChange: (e) => setConfirm(e.target.value), className: "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" }), _jsx("button", { type: "submit", disabled: submitting, className: "mt-6 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60", children: submitting ? "Saving…" : "Update password" }), _jsx("button", { type: "button", onClick: () => logout(), className: "mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50", children: "Sign out" })] }) }));
}
