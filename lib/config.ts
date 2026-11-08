/** Product configuration in one place. Rename the product here (and in the PRD's open decisions). */
export const PRODUCT = {
  name: "Gridwise", // placeholder, see PRD section 18 (product name and domain)
  tagline: "Learn Excel by typing real formulas, with feedback in seconds.",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  minimumAge: 16, // PRD open decision: confirm with legal advice (section 18)
  disclaimer: "Microsoft Excel is a trademark of Microsoft. Gridwise is an independent product and is not affiliated with or endorsed by Microsoft.",
};

/** While false (public beta) every module is open. Set NEXT_PUBLIC_PAYWALL_ENABLED=true when Stage 6 goes live. */
export const PAYWALL_ENABLED = process.env.NEXT_PUBLIC_PAYWALL_ENABLED === "true";

export const PRICES = {
  IN: { currency: "INR", symbol: "₹", monthly: 199, yearly: 1499 },
  GLOBAL: { currency: "USD", symbol: "$", monthly: 7, yearly: 49 },
} as const;
