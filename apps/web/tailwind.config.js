/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // Status (semantic) — used by StatusPill via mapStatusToSemantic
        status: {
          available:   "#10b981",
          interested:  "#3b82f6",
          reserved:    "#f59e0b",
          booked:      "#8b5cf6",
          sold:        "#ef4444",
          blocked:     "#6b7280",
          handed_over: "#1f2937",
        },
      },
      fontSize: {
        // Standardised type scale (px reference)
        "title-xl":  ["1.875rem", { lineHeight: "2.25rem", fontWeight: "600", letterSpacing: "-0.02em" }],
        "title-lg":  ["1.5rem",   { lineHeight: "2rem",    fontWeight: "600", letterSpacing: "-0.01em" }],
        "title-md":  ["1.125rem", { lineHeight: "1.5rem",  fontWeight: "600" }],
        "label":     ["0.75rem",  { lineHeight: "1rem",    fontWeight: "600" }],
      },
      borderRadius: {
        card: "0.75rem",   // 12px — cards/sections
        ctrl: "0.5rem",    // 8px  — buttons/inputs
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
      keyframes: {
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
      },
      animation: {
        "skeleton-pulse": "skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
