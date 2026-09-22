import { BRAND_NAME, LOGO_SRC } from "@/lib/site";

type BrandMarkProps = {
  variant: "topbar" | "hero";
};

export function BrandMark({ variant }: BrandMarkProps) {
  if (variant === "hero") {
    return (
      <a
        className="brand-hero"
        href="#sm-top"
        aria-label={BRAND_NAME}
        data-sm-scroll="sm-top"
      >
        <img src={LOGO_SRC} width={56} height={56} alt="" />
        <span>{BRAND_NAME}</span>
      </a>
    );
  }

  return (
    <a className="brand" href="#sm-top" data-sm-scroll="sm-top">
      <img src={LOGO_SRC} width={40} height={40} alt="" />
      {BRAND_NAME}
    </a>
  );
}
