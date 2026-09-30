import Link from "next/link";

export type ResearchSummaryItem = {
  id: string;
  href: string;
  title: string;
  label?: string;
  source?: string;
  design?: string;
  readLabel: string;
};

export function studySource(journal?: string | null, year?: number | null) {
  const name = journal?.trim();
  const yearLabel = typeof year === "number" ? String(year) : "";
  if (name && yearLabel) return `${name} · ${yearLabel}`;
  return name || yearLabel || undefined;
}

export function ResearchSummaryList({ items }: { items: ResearchSummaryItem[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="related-studies-list">
      {items.map((item) => (
        <li key={item.id} className="related-study">
          {item.label ? <p className="related-study-label">{item.label}</p> : null}
          <h3 className="related-study-title">
            <Link href={item.href}>{item.title}</Link>
          </h3>
          {item.source ? (
            <p className="related-study-source">
              <bdi dir="ltr">{item.source}</bdi>
            </p>
          ) : null}
          {item.design ? <p className="related-study-design">{item.design}</p> : null}
          <Link className="related-study-link text-link" href={item.href}>
            {item.readLabel}
            <span className="icon-directional" aria-hidden="true">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
