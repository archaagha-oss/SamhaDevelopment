/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        status: {
          available: "#10b981",
          interested: "#3b82f6",
          reserved: "#f59e0b",
          booked: "#8b5cf6",
          sold: "#ef4444",
          blocked: "#6b7280",
          handed_over: "#1f2937",
        },
      },
    },
  },
  plugins: [],
};
