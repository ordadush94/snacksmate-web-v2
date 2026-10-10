import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { researchItemPath } from "../content/research";
import { researchByLanguageAndSlugQuery } from "../sanity/lib/queries";
import { researchReaderTitle } from "./research-display";

test("reader-facing research titles prefer a localized seoTitle", () => {
  assert.equal(
    researchReaderTitle({
      title: "A two-minute exercise snack may be sufficient",
      seoTitle: "שתי דקות של חטיף תנועה וחמצון שומנים",
    }),
    "שתי דקות של חטיף תנועה וחמצון שומנים",
  );
  assert.equal(
    researchReaderTitle({ title: "English study", seoTitle: "   " }),
    "English study",
  );
  assert.equal(researchReaderTitle({ title: "English study" }), "English study");
});

test("published research routes use the locale and slug, including after the build", () => {
  assert.match(researchByLanguageAndSlugQuery, /language == \$language/);
  assert.match(researchByLanguageAndSlugQuery, /slug\.current == \$slug/);
  assert.equal(researchByLanguageAndSlugQuery.includes("_id =="), false);

  const layout = readFileSync(
    new URL("../app/[lang]/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.match(layout, /export const dynamicParams = true/);
  assert.doesNotMatch(layout, /export const dynamicParams = false/);

  const card = readFileSync(
    new URL("../components/research/ResearchCard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(card, /researchItemPath\(locale, item\.slug\)/);
  assert.match(card, /researchReaderTitle\(item\)/);
  assert.equal(
    researchItemPath(
      "he",
      "a-two-minute-exercise-snack-may-be-sufficient-to-enhance-energy-metabolism-and-fat-oxidation-in",
    ),
    "/he/research/a-two-minute-exercise-snack-may-be-sufficient-to-enhance-energy-metabolism-and-fat-oxidation-in/",
  );
});
