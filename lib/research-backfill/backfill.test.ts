import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCrossrefClient } from "../research-discovery/crossref";
import type { ResearchIdentity } from "../research-discovery/dedupe";
import { parseBackfillArgs } from "./args";
import { matchExistingStudy } from "./existing";
import { rankResearchCandidates, type RankableStudy } from "./rank";
import { formatBackfillReport } from "./report";
import { runResearchBackfill } from "./run";
import {
  citationMetrics,
  combinePriority,
  PRIORITY_WEIGHTS,
  publicationAgeYears,
} from "./score";

const CURRENT_YEAR = 2026;

function study(overrides: Partial<RankableStudy> & Pick<RankableStudy, "pmid" | "title">): RankableStudy {
  return {
    abstract: "",
    abstractSections: [],
    publicationTypes: ["Journal Article"],
    year: 2022,
    citationCount: null,
    citationSource: null,
    ...overrides,
  };
}

test("matches an existing document by PMID before DOI or title", () => {
  const match = matchExistingStudy(
    {
      pmid: "111",
      doi: "10.9999/other",
      title: "Different title",
    },
    [
      {
        id: "drafts.research-pubmed-111",
        pmid: "111",
        doi: "10.1000/aaa",
        title: "Exercise snacks improve fitness",
        language: "en",
      },
      {
        id: "research-other",
        doi: "10.9999/other",
        title: "Different title",
        language: "en",
      },
    ],
  );
  assert.equal(match?.existing, true);
  assert.equal(match?.action, "skip");
  assert.equal(match?.matchReason, "pmid");
  assert.equal(match?.matchedDocumentId, "drafts.research-pubmed-111");
});

test("matches a normalized DOI when the PMID differs", () => {
  const match = matchExistingStudy(
    {
      pmid: "222",
      doi: "DOI:10.2000/BBB.",
      title: "Another title",
    },
    [
      {
        id: "research-manual-1",
        doi: "https://doi.org/10.2000/bbb",
        title: "Stored title",
        language: "en",
      },
    ],
  );
  assert.equal(match?.action, "skip");
  assert.equal(match?.matchReason, "doi");
  assert.equal(match?.matchedDocumentId, "research-manual-1");
});

test("falls back to a normalized exact title", () => {
  const match = matchExistingStudy(
    { title: "Exercise Snacks Improve Fitness!" },
    [
      {
        id: "research-pubmed-111",
        title: "exercise snacks improve fitness",
        language: "en",
      },
    ],
  );
  assert.equal(match?.matchReason, "title");
  assert.equal(match?.matchedDocumentId, "research-pubmed-111");
  assert.equal(match?.action, "skip");
});

test("treats an English document and its Hebrew translation as one study", () => {
  const existing: ResearchIdentity[] = [
    {
      id: "research-pubmed-111",
      pmid: "111",
      doi: "10.1000/abc",
      title: "Exercise snacks improve fitness",
      slug: "exercise-snacks-improve-fitness",
      language: "en",
    },
    {
      id: "drafts.research-he-research-pubmed-111",
      title: "נשנושי כושר משפרים כושר",
      slug: "exercise-snacks-improve-fitness-he",
      language: "he",
      translationSourceId: "research-pubmed-111",
      translationSlug: "exercise-snacks-improve-fitness",
    },
  ];
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing,
    studies: [
      study({
        pmid: "111",
        doi: "10.1000/abc",
        title: "Exercise snacks improve fitness",
      }),
    ],
  });

  assert.equal(ranking.alreadyInSanity, 1);
  assert.equal(ranking.eligibleNew, 0);
  assert.equal(ranking.skipped.length, 1);
  assert.equal(ranking.skipped[0]?.action, "skip");
  assert.equal(ranking.skipped[0]?.existing, true);
  assert.deepEqual(ranking.skipped[0]?.studyDocumentIds, [
    "research-pubmed-111",
    "drafts.research-he-research-pubmed-111",
  ]);
  assert.equal(ranking.eligible.length, 0);
});

test("an existing draft causes skip", () => {
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [
      {
        id: "drafts.research-pubmed-500",
        pmid: "500",
        title: "Exercise snacks and blood pressure",
        language: "en",
      },
    ],
    studies: [study({ pmid: "500", title: "Exercise snacks and blood pressure" })],
  });
  assert.equal(ranking.skipped[0]?.action, "skip");
  assert.equal(ranking.skipped[0]?.matchedDocumentId, "drafts.research-pubmed-500");
  assert.equal(ranking.eligibleNew, 0);
});

test("an existing published study causes skip", () => {
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [
      {
        id: "research-pubmed-500",
        pmid: "500",
        title: "Exercise snacks and blood pressure",
        language: "en",
      },
    ],
    studies: [study({ pmid: "500", title: "Exercise snacks and blood pressure" })],
  });
  assert.equal(ranking.skipped[0]?.action, "skip");
  assert.equal(ranking.skipped[0]?.matchedDocumentId, "research-pubmed-500");
  assert.equal(ranking.skipped[0]?.matchedDocumentId.startsWith("drafts."), false);
});

test("rejects an irrelevant highly cited study", () => {
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [],
    studies: [
      study({
        pmid: "900",
        title: "Pre-Exercise Snacking and hunger during a fast",
        abstract: "Participants ate a snack before exercise.",
        year: 2020,
        citationCount: 9000,
        citationSource: "crossref",
      }),
      study({
        pmid: "901",
        title: "Exercise snacks improve fitness",
        citationCount: 2,
        citationSource: "crossref",
      }),
    ],
  });
  assert.equal(ranking.rejectedIrrelevant, 1);
  assert.equal(ranking.ranked.some((candidate) => candidate.pmid === "900"), false);
  assert.equal(ranking.eligible[0]?.pmid, "901");
});

test("citation score does not outrank a clearer relevance match", () => {
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [],
    studies: [
      study({
        pmid: "1",
        title: "Exercise snacks improve fitness",
        year: 2022,
        citationCount: 0,
        citationSource: "crossref",
      }),
      study({
        pmid: "2",
        title: "Stair climbing breaks and postprandial glucose",
        abstract: "Objective: To test whether exercise snacks improve postprandial glucose.",
        abstractSections: [
          {
            label: "Objective",
            text: "To test whether exercise snacks improve postprandial glucose.",
          },
        ],
        year: 2022,
        citationCount: 5000,
        citationSource: "crossref",
      }),
    ],
  });
  assert.equal(ranking.ranked[0]?.pmid, "1");
  assert.ok((ranking.ranked[0]?.relevanceScore ?? 0) > (ranking.ranked[1]?.relevanceScore ?? 0));
  assert.ok((ranking.ranked[1]?.citationScore ?? 0) > (ranking.ranked[0]?.citationScore ?? 0));
});

test("normalizes older papers by publication age", () => {
  const older = citationMetrics({ citationCount: 70, year: 2019, currentYear: CURRENT_YEAR });
  const newer = citationMetrics({ citationCount: 40, year: 2024, currentYear: CURRENT_YEAR });
  assert.equal(publicationAgeYears(2019, CURRENT_YEAR), 8);
  assert.equal(publicationAgeYears(2024, CURRENT_YEAR), 3);
  assert.ok((older.citationCount ?? 0) > (newer.citationCount ?? 0));
  assert.ok((newer.citationsPerYear ?? 0) > (older.citationsPerYear ?? 0));
  assert.ok(newer.citationScore > older.citationScore);
});

test("a missing citation count does not crash ranking", () => {
  const metrics = citationMetrics({ citationCount: null, year: 2022, currentYear: CURRENT_YEAR });
  assert.equal(metrics.citationCount, null);
  assert.equal(metrics.citationsPerYear, null);
  assert.equal(metrics.citationScore, 0);

  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [],
    studies: [
      study({
        pmid: "3",
        title: "Exercise snacks and glucose: a randomized crossover trial",
        year: 2023,
        citationCount: undefined,
        sampleSize: undefined,
        abstract: "Adults were enrolled (n = 40) but the count is not in a methods label.",
      }),
    ],
  });
  const candidate = ranking.ranked[0];
  assert.ok(candidate);
  assert.equal(candidate.citationCount, null);
  assert.equal(candidate.citationsPerYear, null);
  assert.equal(candidate.citationScore, 0);
  assert.equal(candidate.citationSource, null);
  assert.equal(candidate.sampleSize, null);
  assert.equal(candidate.sampleSizeSignal, 0);
  assert.equal(Number.isFinite(candidate.priorityScore), true);
  assert.match(candidate.reason, /citation count unavailable/);
  assert.match(candidate.reason, /not currently in Sanity/);
});

test("a recent strong study still ranks above an older less relevant highly cited paper", () => {
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [],
    studies: [
      study({
        pmid: "10",
        title: "Exercise snacks in adults: a randomized controlled trial",
        year: 2025,
        citationCount: 12,
        citationSource: "crossref",
        sampleSize: 60,
        publicationTypes: ["Journal Article", "Randomized Controlled Trial"],
      }),
      study({
        pmid: "11",
        title: "Stair climbing breaks and postprandial glucose",
        abstract: "Objective: To test whether exercise snacks improve postprandial glucose.",
        abstractSections: [
          {
            label: "Objective",
            text: "To test whether exercise snacks improve postprandial glucose.",
          },
        ],
        year: 2019,
        citationCount: 400,
        citationSource: "crossref",
      }),
    ],
  });
  assert.equal(ranking.ranked[0]?.pmid, "10");
  assert.ok((ranking.ranked[0]?.priorityScore ?? 0) > 80);
  assert.match(ranking.ranked[0]?.reason ?? "", /Highly relevant randomized controlled trial; 2025; 12 citations/);
});

test("a qualitative paper is not scored as a randomized trial from a parent publication type", () => {
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [],
    studies: [
      study({
        pmid: "40",
        title:
          "Health professionals' experiences of Snacktivity in routine consultations: a qualitative study",
        publicationTypes: ["Journal Article", "Randomized Controlled Trial"],
        year: 2024,
        citationCount: 3,
        citationSource: "crossref",
      }),
    ],
  });
  assert.equal(ranking.ranked[0]?.designLabel, "qualitative study");
  assert.equal(ranking.ranked[0]?.designScore, 36);
});

test("recency does not outrank stronger study design", () => {
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [],
    studies: [
      study({
        pmid: "20",
        title: "Exercise snacks are feasible at work",
        year: 2026,
        citationCount: 0,
        citationSource: "crossref",
      }),
      study({
        pmid: "21",
        title: "Exercise snacks and fitness: a randomized controlled trial",
        year: 2019,
        citationCount: 0,
        citationSource: "crossref",
        publicationTypes: ["Randomized Controlled Trial"],
      }),
    ],
  });
  assert.equal(ranking.ranked[0]?.pmid, "21");
  assert.ok((ranking.ranked[0]?.designScore ?? 0) > (ranking.ranked[1]?.designScore ?? 0));
  assert.ok((ranking.ranked[1]?.recencyScore ?? 0) > (ranking.ranked[0]?.recencyScore ?? 0));
});

test("a large cohort receives only a modest sample-size boost", () => {
  const shared = {
    abstract: "This prospective cohort study followed adults.",
    year: 2022,
    citationCount: 40,
    citationSource: "crossref" as const,
    publicationTypes: ["Journal Article", "Observational Study"],
  };
  const ranking = rankResearchCandidates({
    currentYear: CURRENT_YEAR,
    limit: 30,
    existing: [],
    studies: [
      study({
        pmid: "30",
        ...shared,
        sampleSize: 200,
        title:
          "Device-measured vigorous intermittent lifestyle physical activity and mortality in a small prospective cohort study",
      }),
      study({
        pmid: "31",
        ...shared,
        sampleSize: 20_000,
        title:
          "Device-measured vigorous intermittent lifestyle physical activity and mortality in a large prospective cohort study",
      }),
    ],
  });
  const small = ranking.ranked.find((candidate) => candidate.pmid === "30");
  const large = ranking.ranked.find((candidate) => candidate.pmid === "31");
  assert.ok(small && large);
  assert.ok(large.sampleSizeSignal > small.sampleSizeSignal);
  assert.ok(large.priorityScore - small.priorityScore < 8);
  assert.equal(large.priorityScore > small.priorityScore, true);
});

test("priority weights stay explicit and sum to 1", () => {
  const sum = Object.values(PRIORITY_WEIGHTS).reduce((total, weight) => total + weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(PRIORITY_WEIGHTS.relevance > PRIORITY_WEIGHTS.design);
  assert.ok(PRIORITY_WEIGHTS.design > PRIORITY_WEIGHTS.citation);
  assert.ok(PRIORITY_WEIGHTS.citation > PRIORITY_WEIGHTS.recency);
  const parts = {
    relevanceScore: 100,
    designScore: 100,
    citationScore: 100,
    sampleSizeSignal: 100,
    recencyScore: 100,
  };
  assert.equal(combinePriority(parts), 100);
});

test("dry-run is the default and writing is refused", () => {
  const args = parseBackfillArgs(["--from=2019-01-01", "--limit=30", "--dry-run"], new Date("2026-09-28T12:00:00Z"));
  assert.equal(args.dryRun, true);
  assert.equal(args.from, "2019-01-01");
  assert.equal(args.to, "2026-09-28");
  assert.equal(args.limit, 30);

  const defaults = parseBackfillArgs([], new Date("2026-09-28T00:00:00Z"));
  assert.equal(defaults.dryRun, true);
  assert.equal(defaults.from, "2019-01-01");
  assert.equal(defaults.limit, 30);

  assert.throws(() => parseBackfillArgs(["--write"]), /dry-run only/);
  assert.throws(() => parseBackfillArgs(["--no-dry-run"]), /dry-run only/);
  assert.throws(() => parseBackfillArgs(["--limit=101"]), /1 to 100/);
});

test("Crossref citation counts keep their source and may be missing", async () => {
  const client = createCrossrefClient({
    email: "research@snacksmate.com",
    sleep: async () => {},
    fetchImpl: async (input) => {
      const url = String(input);
      if (decodeURIComponent(url).endsWith("/10.1000/cited")) {
        return new Response(
          JSON.stringify({
            message: {
              DOI: "10.1000/cited",
              "is-referenced-by-count": 48,
              title: ["Exercise snacks"],
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ message: { DOI: "10.1000/none", title: ["Exercise snacks"] } }),
        { status: 200 },
      );
    },
  });

  const cited = await client.lookup("https://doi.org/10.1000/cited");
  assert.equal(cited?.citationCount, 48);
  assert.equal(cited?.citationSource, "crossref");
  const missing = await client.lookup("10.1000/none");
  assert.equal(missing?.citationCount, undefined);
  assert.equal(missing?.citationSource, undefined);
});

test("dry-run produces zero Sanity writes", async () => {
  const writes: string[] = [];
  let fetches = 0;
  const sanityClient = new Proxy(
    {
      fetch: async () => {
        fetches += 1;
        return [
          {
            id: "drafts.research-pubmed-111",
            pmid: "111",
            doi: "10.1000/existing",
            title: "Exercise snacks improve fitness",
            language: "en",
          },
        ];
      },
    },
    {
      get(target, prop) {
        if (prop === "fetch") return target.fetch;
        if (typeof prop === "symbol" || prop === "then") return undefined;
        writes.push(String(prop));
        return () => {
          throw new Error(`unexpected Sanity ${String(prop)}`);
        };
      },
    },
  );

  await assert.rejects(
    () =>
      runResearchBackfill({
        dryRun: false,
        from: "2019-01-01",
        to: "2026-09-28",
        limit: 30,
        email: "research@snacksmate.com",
        sanityClient,
        fetchImpl: async () => {
          throw new Error("network should not be called");
        },
      }),
    /dry-run only/,
  );
  assert.equal(fetches, 0);
  assert.deepEqual(writes, []);

  const urls: string[] = [];
  const result = await runResearchBackfill({
    dryRun: true,
    from: "2019-01-01",
    to: "2026-09-28",
    limit: 30,
    email: "research@snacksmate.com",
    sanityClient,
    sleep: async () => {},
    now: () => 0,
    fetchImpl: async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("esearch.fcgi")) {
        const params = new URL(url).searchParams;
        assert.equal(params.get("datetype"), "pdat");
        assert.equal(params.get("reldate"), null);
        const term = params.get("term");
        const ids = term === '"exercise snacks"' ? ["111", "222", "333"] : [];
        return new Response(
          JSON.stringify({ esearchresult: { count: String(ids.length), idlist: ids } }),
          { status: 200 },
        );
      }
      if (url.includes("efetch.fcgi")) {
        return new Response(FETCH_XML, { status: 200 });
      }
      if (url.includes("api.crossref.org")) {
        return new Response(
          JSON.stringify({
            message: {
              DOI: "10.1000/cross",
              "is-referenced-by-count": 48,
              title: ["Exercise snacks and glucose: a randomized crossover trial"],
            },
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected request ${url}`);
    },
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.sanityWrites, 0);
  assert.equal(fetches, 1);
  assert.deepEqual(writes, []);
  assert.equal(result.rejectedIrrelevant, 1);
  assert.equal(result.eligible.some((candidate) => candidate.pmid === "222"), true);
  assert.equal(result.skipped.some((candidate) => candidate.pmid === "111"), true);
  const rankedNew = result.eligible.find((candidate) => candidate.pmid === "222");
  assert.equal(rankedNew?.citationCount, 48);
  assert.equal(rankedNew?.citationSource, "crossref");
  assert.equal(rankedNew?.action, "eligible");
  assert.equal(result.ranked.some((candidate) => candidate.pmid === "333"), false);

  const report = formatBackfillReport(result);
  assert.match(report, /ELIGIBLE NEW STUDIES/);
  assert.match(report, /ALREADY IN SANITY — SKIPPED/);
  assert.match(report, /Sanity mutations: 0/);
  assert.match(report, /Published: nothing/);
  assert.match(report, /drafts\.research-pubmed-111/);
});

test("the backfill runner has no Sanity write calls", () => {
  const source = readFileSync(new URL("./run.ts", import.meta.url), "utf8");
  assert.equal(source.includes("createResearchDraft"), false);
  assert.equal(source.includes(".create("), false);
  assert.equal(source.includes(".mutate("), false);
  assert.equal(source.includes(".patch("), false);
  assert.equal(source.includes(".delete("), false);
});

test("the manual workflow is dry-run only and does not replace discovery", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/research-backfill.yml", import.meta.url),
    "utf8",
  );
  const discovery = readFileSync(
    new URL("../../.github/workflows/research-discovery.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /name: Research Backfill/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.equal(workflow.includes("schedule:"), false);
  assert.match(workflow, /fromYear:[\s\S]*default: "2019"/);
  assert.match(workflow, /limit:[\s\S]*default: "30"/);
  assert.match(workflow, /dryRun:[\s\S]*default: true/);
  assert.match(workflow, /--dry-run/);
  assert.match(workflow, /dry-run only/);
  assert.equal(workflow.includes("research:discover"), false);
  assert.match(discovery, /schedule:/);
  assert.match(discovery, /cron:/);
});

const FETCH_XML = `<?xml version="1.0" ?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">111</PMID>
      <Article>
        <Journal><Title>J</Title><JournalIssue><PubDate><Year>2021</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Exercise snacks improve fitness</ArticleTitle>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
      </Article>
    </MedlineCitation>
    <PubmedData><ArticleIdList><ArticleId IdType="doi">10.1000/existing</ArticleId></ArticleIdList></PubmedData>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">222</PMID>
      <Article>
        <Journal><Title>J</Title><JournalIssue><PubDate><Year>2022</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Exercise snacks and glucose: a randomized crossover trial</ArticleTitle>
        <Abstract><AbstractText Label="Methods">Adults completed a randomized crossover trial.</AbstractText></Abstract>
        <PublicationTypeList>
          <PublicationType>Journal Article</PublicationType>
          <PublicationType>Randomized Controlled Trial</PublicationType>
        </PublicationTypeList>
      </Article>
    </MedlineCitation>
    <PubmedData><ArticleIdList><ArticleId IdType="doi">10.1000/cross</ArticleId></ArticleIdList></PubmedData>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">333</PMID>
      <Article>
        <Journal><Title>J</Title><JournalIssue><PubDate><Year>2020</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Pre-Exercise Snacking and hunger during a fast</ArticleTitle>
        <Abstract><AbstractText>Participants ate a snack before exercise.</AbstractText></Abstract>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;
