import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Surface tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Brand-driven
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Brand scale (parametric — driven by --brand-h, --brand-s)
        brand: {
          50:  "hsl(var(--brand-50))",
          100: "hsl(var(--brand-100))",
          200: "hsl(var(--brand-200))",
          300: "hsl(var(--brand-300))",
          400: "hsl(var(--brand-400))",
          500: "hsl(var(--brand-500))",
          600: "hsl(var(--brand-600))",
          700: "hsl(var(--brand-700))",
          800: "hsl(var(--brand-800))",
          900: "hsl(var(--brand-900))",
          950: "hsl(var(--brand-950))",
          DEFAULT: "hsl(var(--brand-600))",
          foreground: "hsl(0 0% 100%)",
        },

        // Secondary brand scale (parametric — driven by --brand2-h, --brand2-s)
        "brand-2": {
          50:  "hsl(var(--brand2-50))",
          100: "hsl(var(--brand2-100))",
          200: "hsl(var(--brand2-200))",
          300: "hsl(var(--brand2-300))",
          400: "hsl(var(--brand2-400))",
          500: "hsl(var(--brand2-500))",
          600: "hsl(var(--brand2-600))",
          700: "hsl(var(--brand2-700))",
          800: "hsl(var(--brand2-800))",
          900: "hsl(var(--brand2-900))",
          950: "hsl(var(--brand2-950))",
          DEFAULT: "hsl(var(--brand2-600))",
          foreground: "hsl(0 0% 100%)",
        },

        // Secondary semantic accent (mapped from brand-2)
        "accent-2": {
          DEFAULT: "hsl(var(--accent-2))",
          foreground: "hsl(var(--accent-2-foreground))",
          soft: "hsl(var(--accent-2-soft))",
          "soft-foreground": "hsl(var(--accent-2-soft-foreground))",
        },

        // Neutral scale (independent of brand)
        neutral: {
          0:   "hsl(var(--neutral-0))",
          50:  "hsl(var(--neutral-50))",
          100: "hsl(var(--neutral-100))",
          200: "hsl(var(--neutral-200))",
          300: "hsl(var(--neutral-300))",
          400: "hsl(var(--neutral-400))",
          500: "hsl(var(--neutral-500))",
          600: "hsl(var(--neutral-600))",
          700: "hsl(var(--neutral-700))",
          800: "hsl(var(--neutral-800))",
          900: "hsl(var(--neutral-900))",
          950: "hsl(var(--neutral-950))",
        },

        // Semantic status with solid + soft variants
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
          "soft-foreground": "hsl(var(--destructive-soft-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
          "soft-foreground": "hsl(var(--success-soft-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
          "soft-foreground": "hsl(var(--warning-soft-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
          "soft-foreground": "hsl(var(--info-soft-foreground))",
        },

        // Pipeline stage tokens (lead/deal/unit lifecycle)
        stage: {
          neutral: {
            DEFAULT: "hsl(var(--stage-neutral))",
            foreground: "hsl(var(--stage-neutral-fg))",
          },
          progress: {
            DEFAULT: "hsl(var(--stage-progress))",
            foreground: "hsl(var(--stage-progress-fg))",
          },
          active: {
            DEFAULT: "hsl(var(--stage-active))",
            foreground: "hsl(var(--stage-active-fg))",
          },
          attention: {
            DEFAULT: "hsl(var(--stage-attention))",
            foreground: "hsl(var(--stage-attention-fg))",
          },
          success: {
            DEFAULT: "hsl(var(--stage-success))",
            foreground: "hsl(var(--stage-success-fg))",
          },
          danger: {
            DEFAULT: "hsl(var(--stage-danger))",
            foreground: "hsl(var(--stage-danger-fg))",
          },
          info: {
            DEFAULT: "hsl(var(--stage-info))",
            foreground: "hsl(var(--stage-info-fg))",
          },
        },

        // Chart palette (categorical)
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
          7: "hsl(var(--chart-7))",
          8: "hsl(var(--chart-8))",
        },

        // Legacy status (back-compat during sweep — prefer `stage-*` tokens)
        status: {
          available: "hsl(var(--status-available))",
          interested: "hsl(var(--status-interested))",
          reserved: "hsl(var(--status-reserved))",
          booked: "hsl(var(--status-booked))",
          sold: "hsl(var(--status-sold))",
          blocked: "hsl(var(--status-blocked))",
          handed_over: "hsl(var(--status-handed-over))",
        },
      },

      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },

      transitionDuration: {
        fast: "var(--duration-fast)",
        DEFAULT: "var(--duration-base)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },

      transitionTimingFunction: {
        "brand-out": "var(--ease-out)",
        "brand-in": "var(--ease-in)",
        "brand-in-out": "var(--ease-in-out)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};
