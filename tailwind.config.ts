import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDark: "#090d16",
        bgCard: "rgba(17, 24, 39, 0.85)",
        borderGlow: "rgba(59, 130, 246, 0.2)",
        accentGlow: "rgba(59, 130, 246, 0.4)",
        bluePrimary: "#3b82f6",
        blueHover: "#1d4ed8",
        greenPrimary: "#10b981",
        redPrimary: "#ef4444",
        textPrimary: "#f3f4f6",
        textSecondary: "#9ca3af",
      },
      fontFamily: {
        orbitron: ["var(--font-orbitron)"],
        outfit: ["var(--font-outfit)"],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;
