import type { LandingContent } from "@/content/types";
import { BrandMark } from "@/components/landing/BrandMark";
import { DeviceFrame } from "@/components/landing/DeviceFrame";
import { StoreButtons } from "@/components/landing/StoreButtons";

const HERO_SCREEN = {
  src: "/screens/choose.webp",
  width: 540,
  height: 1105,
};

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
            <a className="btn btn-primary" href="#sm-download" data-sm-scroll="sm-download">
              {content.hero.downloadCta}
            </a>
            <a className="btn-text" href="#sm-what" data-sm-scroll="sm-what">
              {content.hero.conceptCta}
            </a>
          </div>
          <StoreButtons store={content.store} tone="quiet" />
        </div>
        <div className="hero-visual">
          <DeviceFrame
            src={HERO_SCREEN.src}
            alt={content.support.screenAlt}
            width={HERO_SCREEN.width}
            height={HERO_SCREEN.height}
            priority
          />
        </div>
      </div>
    </section>
  );
}
