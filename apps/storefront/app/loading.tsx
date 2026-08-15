export default function Loading() {
  return (
    <section className="loading-state" aria-live="polite">
      <span className="loading-dot" />
      <div><strong>Loading BeyondX data</strong><p>Fetching the public delivery contract…</p></div>
    </section>
  );
}
