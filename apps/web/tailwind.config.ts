import type { Config } from "tailwindcss";

// Dark-luxury tokens — deep navy base, gold accent, warm off-white text.
// Mirrored in packages/ui as a plain TS token file for React Native.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060B1E",
          900: "#0A1128",
          800: "#111a3a",
          700: "#1a244d",
          600: "#26325f",
        },
        gold: {
          DEFAULT: "#C9A227",
          soft: "#E0BE52",
        },
        cream: "#F5EFE1",
        slateblue: "#6B7DA8", // WAIT verdict
        amber: { guardian: "#E8A13A" },
        rebate: "#5FB98B", // success / refund
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "ui-serif", "serif"],
        body: ['"Inter"', "system-ui", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(0,0,0,0.55)",
        glow: "0 0 0 1px rgba(201,162,39,0.25), 0 8px 30px -8px rgba(201,162,39,0.15)",
      },
      keyframes: {
        slidein: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { slidein: "slidein 0.35s ease-out both" },
    },
  },
  plugins: [],
};

export default config;
