import type { LandingContent } from "@/content/types";
import { APP_ICON_SRC } from "@/lib/site";
import { BrandMark } from "@/components/landing/BrandMark";
import { StoreButtons } from "@/components/landing/StoreButtons";

type HeroProps = {
  content: LandingContent;
};

export function Hero({ content }: HeroProps) {
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <BrandMark variant="hero" />
          <h1>{content.hero.heading}</h1>
          <p className="lede">{content.hero.lede}</p>
          <div className="cta-row">
            <a className="btn btn-ghost" href="#sm-what" data-sm-scroll="sm-what">
              {content.hero.conceptCta}
            </a>
          </div>
          <StoreButtons store={content.store} />
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orb" />
          <img
            className="mascot"
            src={APP_ICON_SRC}
            width={220}
            height={220}
            alt=""
          />
        </div>
      </div>
    </section>
  );
}
