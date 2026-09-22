import type { LandingContent } from "@/content/types";
import { Reveal } from "@/components/landing/Reveal";

type ProblemProps = {
  content: LandingContent["problem"];
};

export function Problem({ content }: ProblemProps) {
  return (
    <section className="problem" id="sm-problem">
      <div className="wrap">
        <Reveal className="section-kicker">{content.kicker}</Reveal>
        <Reveal as="h2">{content.heading}</Reveal>
        <Reveal as="p" className="section-lead">
          {content.lead}
        </Reveal>
        <ul className="problem-list">
          {content.items.map((item, index) => (
            <li key={item.title}>
              <div className="mark" aria-hidden="true">
                {index + 1}
              </div>
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
