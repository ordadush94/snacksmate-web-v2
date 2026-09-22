import type { LandingContent } from "@/content/types";
import { Reveal } from "@/components/landing/Reveal";
import { StoreButtons } from "@/components/landing/StoreButtons";

type DownloadCtaProps = {
  content: LandingContent["download"];
  store: LandingContent["store"];
};

export function DownloadCta({ content, store }: DownloadCtaProps) {
  return (
    <section className="finale" id="sm-download">
      <div className="wrap">
        <Reveal as="div" className="finale-inner">
          <h2>{content.heading}</h2>
          <p className="section-lead">{content.lead}</p>
          <StoreButtons store={store} />
        </Reveal>
      </div>
    </section>
  );
}
