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
