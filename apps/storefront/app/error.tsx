"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="empty-state page-section">
      <span className="eyebrow">Delivery error</span>
      <h1>BeyondX could not serve this view.</h1>
      <p>Confirm the API is running on the configured NEXT_PUBLIC_API_URL and that the required capability/plugin is active.</p>
      <button className="primary" type="button" onClick={reset}>Try again</button>
    </section>
  );
}
