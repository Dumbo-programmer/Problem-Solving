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
        // Warm newsprint charcoal — the "ink" the site is set in.
        ink: {
          50: "#f8f6f4",
          100: "#efece8",
          200: "#ddd8d2",
          300: "#c3bcb3",
          400: "#a09990",
          500: "#7e776e",
          600: "#5f5952",
          700: "#45403a",
          800: "#2d2926",
          900: "#1e1b19",
          950: "#141211"
        },
        // Prothom Alo's brand red. Everything that used to be an orange or a
        // neon accent now resolves to this ramp, so the whole site reads as
        // one brand without touching every component.
        accent: {
          50: "#fef5f3",
          100: "#fde7e2",
          200: "#fccdc3",
          300: "#f8a996",
          400: "#f3755d",
          500: "#ee4023",
          600: "#d92d12",
          700: "#b4210d",
          800: "#921c11",
          900: "#791c12"
        },
        // The historical "neon" ramp. The names survive so the old class
        // names keep working, but every stop is now an editorial red / ink
        // tone — the neon glow is gone from the design.
        neon: {
          pink: "#d92d12",
          magenta: "#b4210d",
          purple: "#8f1d10",
          violet: "#a8240f",
          indigo: "#45403a",
          cyan: "#ee4023",
          teal: "#1f6f5c",
          yellow: "#c08a12"
        },
        // Prothom Alo's brand red, used for the co-brand lockup.
        palo: "#ee4023"
      },
      fontFamily: {
        sans: ["Outfit", "Noto Sans Bengali", "ui-sans-serif", "system-ui", "sans-serif"],
        bengali: ["Noto Sans Bengali", "Outfit", "ui-sans-serif", "sans-serif"],
        // Editorial headlines — the newspaper voice of the site.
        // Family names with a digit ("Source Serif 4") must carry their own
        // quotes, otherwise the whole font-family declaration is invalid.
        display: ['"Source Serif 4"', '"Noto Serif Bengali"', "Georgia", "Cambria", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(30,27,25,0.05), 0 6px 16px -10px rgba(30,27,25,0.18)",
        lift: "0 2px 4px rgba(30,27,25,0.06), 0 14px 32px -14px rgba(30,27,25,0.24)",
        // Kept under their old names; now a quiet brand-tinted shadow.
        "neon-pink": "0 0 0 1px rgba(238,64,35,0.16), 0 8px 24px -12px rgba(238,64,35,0.28)",
        "neon-cyan": "0 0 0 1px rgba(238,64,35,0.14), 0 8px 24px -12px rgba(238,64,35,0.24)",
        "neon-violet": "0 0 0 1px rgba(238,64,35,0.16), 0 10px 28px -14px rgba(238,64,35,0.26)",
        glow: "0 0 0 1px rgba(238,64,35,0.14), 0 18px 40px -22px rgba(238,64,35,0.30)"
      },
      backgroundImage: {
        // Faint dot screen, like newsprint texture.
        "grid-fade":
          "radial-gradient(circle at 1px 1px, rgba(30,27,25,0.10) 1px, transparent 1px)",
        // Thin ruling, used behind the masthead and section breaks.
        "retro-grid":
          "linear-gradient(to right, rgba(30,27,25,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,27,25,0.08) 1px, transparent 1px)",
        // Warm paper wash.
        "retro-sky":
          "linear-gradient(to bottom, #ffffff 0%, #fdfcfa 55%, #fbf7f4 100%)",
        "neon-sheen":
          "linear-gradient(110deg, rgba(238,64,35,0.06) 0%, rgba(238,64,35,0.02) 45%, rgba(238,64,35,0.05) 100%)"
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
        /* ---- motion ---- */
        // The rule line rolls slowly toward the viewer.
        gridflow: {
          "0%": { backgroundPosition: "0 0, 0 0" },
          "100%": { backgroundPosition: "0 46px, 0 46px" }
        },
        // Slow drift for the background washes.
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
