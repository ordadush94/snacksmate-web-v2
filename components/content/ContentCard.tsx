import Link from "next/link";
import type { ReactNode } from "react";

type ContentCardImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type ContentCardProps = {
  href: string;
  title: string;
  linkLabel: string;
  takeaway?: string;
  meta?: ReactNode;
  kicker?: string;
  chips?: string[];
  image?: ContentCardImage;
  featured?: boolean;
};

export function ContentCard({
  href,
  title,
  linkLabel,
  takeaway,
  meta,
  kicker,
  chips,
  image,
  featured = false,
}: ContentCardProps) {
  const visibleChips = chips?.map((chip) => chip.trim()).filter(Boolean);

  return (
    <article className={featured ? "content-card is-featured" : "content-card"}>
      {image ? (
        <Link href={href} className="content-card-image" tabIndex={-1}>
          <img
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
          />
        </Link>
      ) : null}
      <div className="content-card-body">
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        {visibleChips && visibleChips.length > 0 ? (
          <p className="content-card-chips">
            {visibleChips.map((chip, index) => (
              <span className="chip" key={`${chip}-${index}`}>
                {chip}
              </span>
            ))}
          </p>
        ) : null}
        <h2>
          <Link href={href}>{title}</Link>
        </h2>
        {takeaway ? <p className="article-excerpt">{takeaway}</p> : null}
        {meta ? <p className="article-meta">{meta}</p> : null}
        <Link className="text-link" href={href}>
          {linkLabel}
          <span className="sr-only">: {title}</span>
        </Link>
      </div>
    </article>
  );
}
