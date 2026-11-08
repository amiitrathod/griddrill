"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/errors";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => reportError(error, { source: "error-boundary" }), [error]);
  return (
    <div className="mx-auto max-w-content px-4 py-12">
      <h1>Something broke on this page</h1>
      <p className="mt-2">The problem has been recorded. Your saved progress is not affected.</p>
      <button type="button" className="btn-primary mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
