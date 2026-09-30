import type { LandingContent } from "@/content/types";
import { Reveal } from "@/components/landing/Reveal";

type BenefitsProps = {
  content: LandingContent["benefits"];
};

const benefitIcons = [
  <svg
    key="clock"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0f9f72"
    strokeWidth="2.2"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l2.5 1.5" />
  </svg>,
  <svg
    key="trend"
    className="icon-directional"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0f9f72"
    strokeWidth="2.2"
  >
    <path d="M5 16l6-8 4 5 4-6" />
    <path d="M15 7h4v4" />
  </svg>,
  <svg
    key="target"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0f9f72"
    strokeWidth="2.2"
  >
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="8" />
  </svg>,
  <svg
    key="people"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0f9f72"
    strokeWidth="2.2"
  >
    <circle cx="8" cy="10" r="2.5" />
    <circle cx="16" cy="10" r="2.5" />
    <path d="M4.5 17c1-2.2 2.6-3.3 3.5-3.3S11 14.8 12 17M12 17c1-2.2 2.6-3.3 3.5-3.3S19 14.8 19.5 17" />
  </svg>,
];

export function Benefits({ content }: BenefitsProps) {
  return (
    <section id="sm-why">
      <div className="wrap">
        <Reveal className="section-kicker">{content.kicker}</Reveal>
        <Reveal as="h2">{content.heading}</Reveal>
        <Reveal as="p" className="section-lead">
          {content.lead}
        </Reveal>
        <div className="benefits">
          {content.items[0] ? (
            <Reveal as="article" className="benefit benefit-lead" key={content.items[0].title}>
              <div className="icon" aria-hidden="true">
                {benefitIcons[0]}
              </div>
              <h3>{content.items[0].title}</h3>
              <p>{content.items[0].body}</p>
            </Reveal>
          ) : null}
          {content.items.length > 1 ? (
            <div className="benefits-pair">
              {content.items.slice(1, 3).map((item, index) => (
                <Reveal as="article" className="benefit" key={item.title}>
                  <div className="icon" aria-hidden="true">
                    {benefitIcons[index + 1]}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </Reveal>
              ))}
            </div>
          ) : null}
          {content.items.slice(3).map((item, index) => (
            <Reveal as="article" className="benefit benefit-quiet" key={item.title}>
              <div className="icon" aria-hidden="true">
                {benefitIcons[index + 3]}
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
