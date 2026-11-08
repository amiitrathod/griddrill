import type { Config } from "tailwindcss";
import { tokens } from "./docs/design-tokens";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      ink: tokens.color.ink,
      page: tokens.color.page,
      surface: tokens.color.surface,
      primary: tokens.color.primary,
      points: tokens.color.points,
      success: tokens.color.success,
      error: tokens.color.error,
      neutral: tokens.color.neutral,
      white: "#FFFFFF",
    },
    spacing: { 0: "0", 1: "4px", 2: "8px", 4: "16px", 6: "24px", 8: "32px", 12: "48px", px: "1px", full: "100%" },
    borderRadius: { none: "0", control: "6px", card: "8px", full: "9999px" },
    boxShadow: { soft: "0 1px 2px rgba(27,31,36,0.06), 0 2px 8px rgba(27,31,36,0.06)", none: "none" },
    fontFamily: {
      sans: ["Inter Variable", "Inter", "system-ui", "sans-serif"],
      mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
    },
    extend: {
      maxWidth: { content: "1100px", prose: "640px" },
      width: { "1/2": "50%", "1/3": "33.333%", "2/3": "66.666%", screen: "100vw" },
      height: { screen: "100vh" },
      minHeight: { screen: "100vh" },
    },
  },
  plugins: [],
};
export default config;
