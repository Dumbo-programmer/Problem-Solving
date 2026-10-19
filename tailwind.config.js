/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Non-default opacity steps used throughout the UI badges/tints
      // (Tailwind's stock scale only ships multiples of 5).
      opacity: {
        8: "0.08",
        12: "0.12",
        14: "0.14",
      },
      colors: {
        ink: {
          50: "#f4f5fb",
          100: "#e8eaf6",
          200: "#cdd2ec",
          300: "#a5addd",
          400: "#7880c9",
          500: "#585fb2",
          600: "#444896",
          700: "#3a3d7a",
          800: "#333565",
          900: "#2e2f54",
          950: "#1b1b30"
        },
        accent: {
          50: "#fff8eb",
          100: "#ffefc6",
          200: "#ffdc88",
          300: "#ffc44a",
          400: "#ffab1f",
          500: "#f98c07",
          600: "#dd6702",
          700: "#b74706",
          800: "#94370c",
          900: "#7a2f0d"
        }
      },
      fontFamily: {
        sans: ["Outfit", "Noto Sans Bengali", "ui-sans-serif", "system-ui", "sans-serif"],
        bengali: ["Noto Sans Bengali", "Outfit", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,18,40,0.04), 0 8px 24px -8px rgba(16,18,40,0.10)",
        lift: "0 2px 4px rgba(16,18,40,0.05), 0 18px 40px -12px rgba(16,18,40,0.20)"
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 1px 1px, rgba(120,128,201,0.16) 1px, transparent 0)"
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" }
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" }
        },
        pop: {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        }
      },
      animation: {
        floaty: "floaty 7s ease-in-out infinite",
        pop: "pop 0.25s ease-out both",
        slideUp: "slideUp 0.4s cubic-bezier(0.22,1,0.36,1) both"
      }
    }
  },
  plugins: []
};
