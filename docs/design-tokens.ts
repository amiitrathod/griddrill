// Single source of truth for design tokens (PRD section 9). Tailwind reads this file.
export const tokens = {
  color: {
    ink: "#1B1F24",
    page: "#F7F7F5",
    surface: "#FFFFFF",
    primary: "#2A4BD7",
    points: "#F2A900",
    success: "#1C7C54",
    error: "#C0392B",
    // One warm neutral scale
    neutral: {
      50: "#FAF9F7", 100: "#F1EFEB", 200: "#E4E1DB", 300: "#D1CDC5", 400: "#A8A39A",
      500: "#7C776E", 600: "#5C5850", 700: "#423F39", 800: "#2B2925", 900: "#1B1F24",
    },
  },
  spacingPx: [4, 8, 16, 24, 32, 48],
  radius: { control: 6, card: 8 },
  contentMaxWidth: 1100,
} as const;
