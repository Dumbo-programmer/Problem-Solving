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
        14: "0.14"
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
        },
        // Retrowave ramp — magenta → violet → cyan. Ships the "infinity mirror"
        // glow and grid tints without pulling in a second palette library.
        neon: {
          pink: "#ff2d95",
          magenta: "#e6189c",
          purple: "#a855f7",
          violet: "#7c3aed",
          indigo: "#4f46e5",
          cyan: "#22d3ee",
          teal: "#2dd4bf",
          yellow: "#facc15"
        },
        // Prothom Alo's brand red, used for the co-brand lockup.
        palo: "#ee4023"
      },
      fontFamily: {
        sans: ["Outfit", "Noto Sans Bengali", "ui-sans-serif", "system-ui", "sans-serif"],
        bengali: ["Noto Sans Bengali", "Outfit", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,18,40,0.04), 0 8px 24px -8px rgba(16,18,40,0.10)",
        lift: "0 2px 4px rgba(16,18,40,0.05), 0 18px 40px -12px rgba(16,18,40,0.20)",
        // Neon glows for the retrowave surfaces.
        "neon-pink": "0 0 0 1px rgba(255,45,149,0.35), 0 8px 30px -6px rgba(255,45,149,0.55)",
        "neon-cyan": "0 0 0 1px rgba(34,211,238,0.35), 0 8px 30px -6px rgba(34,211,238,0.5)",
        "neon-violet": "0 0 0 1px rgba(168,85,247,0.35), 0 10px 40px -8px rgba(124,58,237,0.55)",
        glow: "0 0 24px -2px rgba(124,58,237,0.45), 0 0 60px -18px rgba(34,211,238,0.35)"
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 1px 1px, rgba(120,128,201,0.16) 1px, transparent 0)",
        // Infinite perspective floor: horizontal + vertical neon lines.
        "retro-grid":
          "linear-gradient(to right, rgba(168,85,247,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,211,238,0.28) 1px, transparent 1px)",
        "retro-sky":
          "linear-gradient(to bottom, #12002b 0%, #2b0a4d 38%, #6d1b6e 62%, #ff2d95 82%, #ff6b3d 100%)",
        "neon-sheen":
          "linear-gradient(110deg, rgba(255,45,149,0.14) 0%, rgba(124,58,237,0.16) 40%, rgba(34,211,238,0.14) 100%)"
      },
      backgroundSize: {
        "retro-grid": "46px 46px"
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
        },
        /* ---- retrowave motion ---- */
        // The horizon grid rolls toward the viewer, forever.
        gridflow: {
          "0%": { backgroundPosition: "0 0, 0 0" },
          "100%": { backgroundPosition: "0 46px, 0 46px" }
        },
        // Slow drift for the infinity-mirror backdrops.
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(0,-14px,0) scale(1.04)" }
        },
        // A curve drawing itself, then fading — used by the SVG plot.
        dash: {
          "0%": { strokeDashoffset: "260" },
          "70%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "0" }
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.03)" }
        },
        scan: {
          "0%": { transform: "translateY(-120%)" },
          "100%": { transform: "translateY(120%)" }
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        }
      },
      animation: {
        floaty: "floaty 7s ease-in-out infinite",
        pop: "pop 0.25s ease-out both",
        slideUp: "slideUp 0.4s cubic-bezier(0.22,1,0.36,1) both",
        gridflow: "gridflow 2.6s linear infinite",
        drift: "drift 12s ease-in-out infinite",
        dash: "dash 6s ease-in-out infinite",
        "pulse-glow": "pulseGlow 5s ease-in-out infinite",
        scan: "scan 7s linear infinite",
        marquee: "marquee 38s linear infinite"
      }
    }
  },
  plugins: []
};
