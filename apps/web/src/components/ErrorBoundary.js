import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
export default class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { error: null }
        });
        Object.defineProperty(this, "reset", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => this.setState({ error: null })
        });
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        if (typeof console !== "undefined") {
            console.error("[ErrorBoundary]", error, info.componentStack);
        }
    }
    render() {
        const { error } = this.state;
        if (!error)
            return this.props.children;
        if (this.props.fallback)
            return this.props.fallback(error, this.reset);
        return (_jsx("div", { role: "alert", className: "min-h-[60vh] flex items-center justify-center p-6", children: _jsxs("div", { className: "max-w-md w-full bg-white border border-red-200 rounded-xl shadow-sm p-6", children: [_jsx("h2", { className: "text-base font-semibold text-red-700", children: "Something went wrong" }), _jsx("p", { className: "mt-1.5 text-sm text-slate-600 leading-relaxed", children: "The page hit an unexpected error. You can retry or return to the dashboard." }), _jsx("pre", { className: "mt-3 max-h-32 overflow-auto rounded bg-slate-50 border border-slate-200 p-2 text-[11px] text-slate-700 whitespace-pre-wrap break-words", children: error.message }), _jsxs("div", { className: "mt-4 flex gap-2 justify-end", children: [_jsx("a", { href: "/", className: "px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors", children: "Go home" }), _jsx("button", { type: "button", onClick: this.reset, className: "px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors", children: "Try again" })] })] }) }));
    }
}
