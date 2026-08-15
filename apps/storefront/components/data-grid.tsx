import { displayValue } from "@/lib/values";

export function DataGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="muted">No public fields are available for this entry.</p>;

  return (
    <dl className="data-grid">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd><pre>{displayValue(value)}</pre></dd>
        </div>
      ))}
    </dl>
  );
}
