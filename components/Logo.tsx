import { tokens } from "@/docs/design-tokens";
import { PRODUCT } from "@/lib/config";

/** Wordmark with a small 3x3 grid mark, drawn with design tokens only. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-ink font-semibold text-lg" style={{ textDecoration: "none" }}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="4" fill="none" stroke={tokens.color.ink} strokeWidth="2" />
        <path d="M1 8.5h22M1 15.5h22M8.5 1v22M15.5 1v22" stroke={tokens.color.ink} strokeWidth="1.5" />
        <rect x="9.5" y="9.5" width="5" height="5" fill={tokens.color.primary} />
      </svg>
      {PRODUCT.name}
    </span>
  );
}
