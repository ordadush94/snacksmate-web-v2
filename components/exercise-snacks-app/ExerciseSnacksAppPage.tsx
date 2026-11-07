import Link from "next/link";
import { breadcrumbJsonLd } from "@/lib/article-seo";
import {
  EXERCISE_SNACKS_APP_CRUMB,
  EXERCISE_SNACKS_APP_DEFINITION,
  EXERCISE_SNACKS_APP_FAQS,
  EXERCISE_SNACKS_APP_H1,
  EXERCISE_SNACKS_APP_INTRO,
  RESEARCH_SECTION_LEAD,
  WHY_APP_LEAD,
  WHY_APP_SECTIONS,
  exerciseSnacksAppCanonicalUrl,
  exerciseSnacksAppFaqJsonLd,
  exerciseSnacksAppResearchHubPath,
  exerciseSnacksAppSoftwareJsonLd,
  exerciseSnacksAppSteps,
  exerciseSnacksAppStoreLinks,
  pickResearchFindings,
  type ArticleRef,
  type StudyRef,
} from "@/lib/exercise-snacks-app";
import { absoluteUrl } from "@/lib/site";
import { JsonLd } from "@/components/articles/JsonLd";
import { StoreButtons } from "@/components/landing/StoreButtons";
import { PublicationShell } from "@/components/site/PublicationShell";

type ExerciseSnacksAppPageProps = {
  articles: ArticleRef[];
  studies: StudyRef[];
};

export function ExerciseSnacksAppPage({
  articles,
  studies,
}: ExerciseSnacksAppPageProps) {
  const canonical = exerciseSnacksAppCanonicalUrl();
  const researchHref = exerciseSnacksAppResearchHubPath();
  const steps = exerciseSnacksAppSteps(articles);
  const findings = pickResearchFindings(studies);
  const homeUrl = absoluteUrl("/en/");

  return (
    <PublicationShell locale="en">
      <article className="app-page">
        <JsonLd
          data={[
            exerciseSnacksAppSoftwareJsonLd(),
            exerciseSnacksAppFaqJsonLd(),
            breadcrumbJsonLd([
              { name: "Home", url: homeUrl },
              { name: EXERCISE_SNACKS_APP_CRUMB, url: canonical },
            ]),
          ]}
        />
        <header className="app-intro">
          <nav className="article-breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/en/">Home</Link>
              </li>
              <li>
                <span aria-hidden="true" className="article-breadcrumb-sep">
                  &gt;
                </span>
                <span aria-current="page">{EXERCISE_SNACKS_APP_CRUMB}</span>
              </li>
            </ol>
          </nav>
          <p className="section-kicker">Snacksmate</p>
          <h1>{EXERCISE_SNACKS_APP_H1}</h1>
          {EXERCISE_SNACKS_APP_INTRO.map((paragraph) => (
            <p className="lede" key={paragraph}>
              {paragraph}
            </p>
          ))}
          <StoreButtons store={exerciseSnacksAppStoreLinks("top")} />
        </header>

        <section aria-labelledby="what-is-a-snack">
          <h2 id="what-is-a-snack">What is an exercise snack?</h2>
          <p>{EXERCISE_SNACKS_APP_DEFINITION}</p>
          <p>
            <Link className="text-link" href={researchHref}>
              Explore the research
            </Link>
          </p>
        </section>

        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works">How Snacksmate works</h2>
          <p className="app-lead">A few small steps, and the break is already done.</p>
          <ol className="app-steps">
            {steps.map((step) => (
              <li key={step.title}>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  {step.links.map((link) => (
                    <p key={link.href}>
                      <Link className="text-link" href={link.href}>
                        {link.label}
                      </Link>
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="why-an-app">
          <h2 id="why-an-app">Why use an app for exercise snacks?</h2>
          <p className="app-lead">{WHY_APP_LEAD}</p>
          <ul className="app-why-list">
            {WHY_APP_SECTIONS.map((section) => (
              <li key={section.title}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="research-says">
          <h2 id="research-says">What the research says</h2>
          <p>{RESEARCH_SECTION_LEAD}</p>
          {findings.length > 0 ? (
            <ul className="app-findings">
              {findings.map((finding) => (
                <li key={finding.topic}>
                  <p>{finding.text}</p>
                  <p>
                    <Link className="text-link" href={finding.href}>
                      {finding.title}
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>The research hub collects these summaries in one place.</p>
          )}
          <p>
            <Link className="text-link" href={researchHref}>
              Browse the research hub
            </Link>
          </p>
        </section>

        <section aria-labelledby="app-faq">
          <h2 id="app-faq">FAQ</h2>
          <dl className="app-faq">
            {EXERCISE_SNACKS_APP_FAQS.map((faq) => (
              <div key={faq.question}>
                <dt>{faq.question}</dt>
                <dd>{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="app-close" aria-labelledby="try-a-snack">
          <h2 id="try-a-snack">Try your first exercise snack today</h2>
          <p>
            Download Snacksmate, pick a snack of a few minutes, and do the first
            one wherever you already are.
          </p>
          <StoreButtons store={exerciseSnacksAppStoreLinks("bottom")} />
        </section>
      </article>
    </PublicationShell>
  );
}
