import type { Config } from "tailwindcss";

/**
 * QatarStore.com design system — dark-luxury.
 * Deep navy base, gold accents, off-white text surfaces.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0B1B33",
          50: "#E7ECF4",
          100: "#C6D1E3",
          200: "#93A6C6",
          300: "#5E77A2",
          400: "#3A527D",
          500: "#213A61",
          600: "#152B4C",
          700: "#0B1B33",
          800: "#081426",
          900: "#050D19",
        },
        gold: {
          DEFAULT: "#C9A24B",
          light: "#E3C583",
          soft: "#F3E9CF",
          dark: "#A6842F",
        },
        cream: {
          DEFAULT: "#F5F2EA",
          dim: "#D9D4C6",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        lift: "0 24px 60px -20px rgba(5,13,25,0.6)",
        card: "0 1px 2px rgba(5,13,25,0.4), 0 18px 40px -24px rgba(5,13,25,0.7)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
