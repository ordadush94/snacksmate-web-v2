import { BRAND_NAME, LOGO_SRC } from "@/lib/site";

type BrandMarkProps = {
  variant: "topbar" | "hero";
  href?: string;
};

export function BrandMark({ variant, href = "#sm-top" }: BrandMarkProps) {
  const scrollId = href.startsWith("#") ? href.slice(1) : undefined;

  if (variant === "hero") {
    return (
      <a
        className="brand-hero"
        href={href}
        aria-label={BRAND_NAME}
        data-sm-scroll={scrollId}
      >
        <img src={LOGO_SRC} width={56} height={56} alt="" />
        <span>{BRAND_NAME}</span>
      </a>
    );
  }

  return (
    <a className="brand" href={href} data-sm-scroll={scrollId}>
      <img src={LOGO_SRC} width={40} height={40} alt="" />
      {BRAND_NAME}
    </a>
  );
}
