import type { LandingContent } from "@/content/types";
import { Reveal } from "@/components/landing/Reveal";

type EffectsProps = {
  content: LandingContent["effects"];
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

export function Effects({ content }: EffectsProps) {
  return (
    <section id="sm-effects">
      <div className="wrap">
        <Reveal className="section-kicker">{content.kicker}</Reveal>
        <Reveal as="h2">{content.heading}</Reveal>
        <Reveal as="p" className="section-lead">
          {content.lead}
        </Reveal>
        <ul className="effects-grid">
          {content.items.map((item) => (
            <li key={item}>
              <span className="effect-mark" aria-hidden="true">
                <CheckIcon />
              </span>
              <p>{item}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
