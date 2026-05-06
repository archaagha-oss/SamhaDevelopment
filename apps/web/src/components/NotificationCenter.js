import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { notificationService } from "../services/notificationService";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Subscribe to notification events
    const unsubscribe = notificationService.subscribe((notification) => {
      setNotifications((prev) => [
        ...prev.slice(-9), // Keep last 10
        notification,
      ]);
    });

    return unsubscribe;
  }, []);

  const severityColors = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };

  const severityIcons = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
  };

  return _jsx("div", {
    className:
      "fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md pointer-events-none",
    children: notifications.map((notif) =>
      _jsxs("div", {
        className: `rounded-lg border p-3 shadow-lg pointer-events-auto ${
          severityColors[notif.severity]
        }`,
        children: [
          _jsxs("div", {
            className: "flex items-start gap-2",
            children: [
              _jsx("span", { children: severityIcons[notif.severity] }),
              _jsxs("div", {
                className: "flex-1",
                children: [
                  _jsx("p", {
                    className: "font-semibold text-sm",
                    children: notif.title,
                  }),
                  _jsx("p", {
                    className: "text-xs mt-0.5 opacity-90",
                    children: notif.message,
                  }),
                ],
              }),
              _jsx("button", {
                onClick: () =>
                  setNotifications((prev) =>
                    prev.filter((n) => n.id !== notif.id)
                  ),
                className: "text-xs opacity-60 hover:opacity-100",
                children: "✕",
              }),
            ],
          }),
        ],
      }, notif.id)
    ),
  });
}
