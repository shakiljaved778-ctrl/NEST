import type { Config } from "tailwindcss";

/**
 * NEST Solutions design tokens — taken from the investor deck:
 * deep navy, gold, teal on a pearl background, serif display type.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#12294B",
          50: "#EDF1F8",
          100: "#D9E1EE",
          200: "#AFC0DB",
          300: "#7F97BD",
          400: "#4A6591",
          500: "#2B4A77",
          600: "#1C3760",
          700: "#12294B",
          800: "#0C1D37",
          900: "#081426",
        },
        gold: {
          DEFAULT: "#C9A227",
          light: "#E8CE6F",
          soft: "#F7EFD4",
          dark: "#A38118",
        },
        teal: {
          DEFAULT: "#0F9D8A",
          light: "#3FC0AE",
          soft: "#E1F4F1",
          dark: "#0B7A6C",
        },
        pearl: "#F5F7FB",
        ink: "#0E1B2C",
        // Terminal palette for the Qatar Market Dashboard (dark-first, dense).
        terminal: {
          bg: "#0a0e17",
          panel: "#111725",
          panel2: "#161d2e",
          border: "#232c40",
          borderLight: "#2d3750",
          muted: "#7b8aa8",
          text: "#c7d2e6",
          bright: "#eef2fb",
          accent: "#3b82f6",
          accent2: "#8b5cf6",
          up: "#16c784",
          upDim: "#0e6b47",
          down: "#ea3943",
          downDim: "#7a2229",
          warn: "#f0b90b",
          qatar: "#8a1538",
        },
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        body: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Noto Sans Arabic'",
          "sans-serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "'SF Mono'",
          "'Roboto Mono'",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,27,44,0.06), 0 8px 24px rgba(14,27,44,0.07)",
        phone: "0 24px 60px rgba(8,20,38,0.35)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
