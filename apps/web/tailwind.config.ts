import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0F172A",
        panel: "#1E293B",
        accent: "#3B82F6",
        accent2: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(59,130,246,.22), 0 12px 32px rgba(15,23,42,.28)",
      },
    },
  },
  plugins: [],
};

export default config;
