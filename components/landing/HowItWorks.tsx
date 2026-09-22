import type { LandingContent } from "@/content/types";
import { Reveal } from "@/components/landing/Reveal";

type HowItWorksProps = {
  content: LandingContent["howItWorks"];
};

export function HowItWorks({ content }: HowItWorksProps) {
  return (
    <section id="sm-how">
      <div className="wrap">
        <Reveal className="section-kicker">{content.kicker}</Reveal>
        <Reveal as="h2">{content.heading}</Reveal>
        <Reveal as="p" className="section-lead">
          {content.lead}
        </Reveal>
        <ol className="steps">
          {content.steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
