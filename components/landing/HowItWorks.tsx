import type { LandingContent } from "@/content/types";
import { DeviceFrame } from "@/components/landing/DeviceFrame";
import { Reveal } from "@/components/landing/Reveal";

type HowItWorksProps = {
  content: LandingContent["howItWorks"];
};

const STEP_SCREENS = [
  { src: "/screens/choose.webp", width: 540, height: 1105 },
  { src: "/screens/move.webp", width: 540, height: 1105 },
  { src: "/screens/progress.webp", width: 540, height: 1105 },
];

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
          {content.steps.map((step, index) => {
            const screen = STEP_SCREENS[index];
            return (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                {screen ? (
                  <DeviceFrame
                    className="step-device"
                    src={screen.src}
                    alt=""
                    width={screen.width}
                    height={screen.height}
                    eager
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
