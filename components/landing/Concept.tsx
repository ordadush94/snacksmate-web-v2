import type { LandingContent } from "@/content/types";
import { Reveal } from "@/components/landing/Reveal";

type ConceptProps = {
  content: LandingContent["concept"];
};

export function Concept({ content }: ConceptProps) {
  return (
    <section id="sm-what">
      <div className="wrap concept-panel">
        <div>
          <Reveal className="section-kicker">{content.kicker}</Reveal>
          <Reveal as="h2">{content.heading}</Reveal>
          <Reveal as="p" className="section-lead">
            {content.lead}
          </Reveal>
          <Reveal className="chips">
            {content.chips.map((chip) => (
              <span className="chip" key={chip}>
                {chip}
              </span>
            ))}
          </Reveal>
        </div>
        <Reveal as="div" className="concept-highlight">
          <p>{content.highlight}</p>
        </Reveal>
      </div>
    </section>
  );
}
