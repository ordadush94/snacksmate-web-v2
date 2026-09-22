import type { LandingContent } from "@/content/types";
import { Reveal } from "@/components/landing/Reveal";

type TrustProps = {
  content: LandingContent["trust"];
};

export function Trust({ content }: TrustProps) {
  return (
    <section className="trust" id="sm-trust">
      <div className="wrap">
        <Reveal as="p" className="trust-quote">
          {content.quote}
        </Reveal>
        <Reveal as="p">{content.body}</Reveal>
      </div>
    </section>
  );
}
