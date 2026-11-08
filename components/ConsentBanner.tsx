"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/lib/analytics";

export function ConsentBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(getConsent() === null), []);
  if (!show) return null;
  const choose = (c: "granted" | "declined") => {
    setConsent(c);
    setShow(false);
  };
  return (
    <div role="region" aria-label="Cookie notice" className="bg-neutral-100 border-b border-neutral-200">
      <div className="mx-auto max-w-content px-4 py-2 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <p className="text-sm flex-1">
          No advertising cookies. May we count anonymous events, such as which lesson was finished, to fix confusing lessons? <Link href="/privacy">Privacy policy</Link>
        </p>
        <div className="flex gap-2 pb-2 md:pb-0">
          <button type="button" className="btn-secondary" onClick={() => choose("declined")}>Essential only</button>
          <button type="button" className="btn-secondary" onClick={() => choose("granted")}>Allow analytics</button>
        </div>
      </div>
    </div>
  );
}
