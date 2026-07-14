import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101B2E",
        inkSoft: "#26364F",
        grove: "#0E8A6D",
        groveDeep: "#0B6B55",
        gold: "#C9A227",
        pearl: "#F6F8FB",
        mist: "#E4EAF2",
        blush: "#D9534F",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        body: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 27, 46, 0.06), 0 8px 24px rgba(16, 27, 46, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
