import assert from "node:assert/strict";
import test from "node:test";

import {
  blockText,
  publicText,
  updateDrafts,
  validateUpdateDrafts,
} from "./update-drafts";

test("ten unpublished article drafts pair English and Hebrew", () => {
  const validation = validateUpdateDrafts();
  assert.deepEqual(validation.errors, []);
  assert.equal(updateDrafts.length, 10);
  assert.equal(updateDrafts.filter((document) => document.language === "en").length, 5);
  assert.equal(updateDrafts.filter((document) => document.language === "he").length, 5);

  for (const document of updateDrafts) {
    assert.equal(document._type, "article");
    assert.equal(document._id.startsWith("drafts."), true);
    assert.equal("mainImage" in document, false);
    assert.equal("canonicalUrl" in document, false);
    assert.equal(document.author, "Snacksmate");
    assert.match(blockText(document.body), /\S/);
  }
});

test("effort drafts describe reflection and do not claim downstream use", () => {
  const effort = updateDrafts.filter((document) => document.translationSlug === "workout-effort-rating");
  const english = effort.find((document) => document.language === "en");
  const hebrew = effort.find((document) => document.language === "he");
  assert.ok(english);
  assert.ok(hebrew);
  assert.match(publicText(english), /very easy, easy, moderate, hard, or max effort/i);
  assert.match(publicText(hebrew), /קל מאוד/);
  assert.match(publicText(hebrew), /מאמץ מקסימלי/);
  assert.doesNotMatch(publicText(english).toLowerCase(), /stored|algorithm|recommendation|future workout/);
  assert.doesNotMatch(publicText(hebrew), /נשמר|אלגוריתם|המלצה/);
});

test("custom snack drafts omit unconfirmed builder fields", () => {
  const custom = updateDrafts.filter((document) => document.translationSlug === "custom-exercise-snacks");
  for (const document of custom) {
    assert.doesNotMatch(publicText(document).toLowerCase(), /work duration|rest duration|number of sets/);
    assert.match(document.translationReviewNote, /could not be confirmed/);
  }
});

test("research drafts keep the study as the source", () => {
  const research = updateDrafts.filter((document) => document.translationSlug === "snacksmate-research-hub");
  for (const document of research) {
    assert.match(publicText(document), /DOI/);
    assert.equal(document.topic, "product-update");
    assert.doesNotMatch(publicText(document), /validates Snacksmate|proves Snacksmate|מוכיח ש־Snacksmate/);
  }
  const english = research.find((document) => document.language === "en");
  const hebrew = research.find((document) => document.language === "he");
  assert.match(publicText(english!), /without having tested Snacksmate/);
  assert.match(publicText(hebrew!), /Snacksmate עצמה לא נבחנה בו/);
  assert.equal(english?.body.at(-1)?.markDefs[0]?.href, "/en/research/");
  assert.equal(hebrew?.body.at(-1)?.markDefs[0]?.href, "/he/research/");
});
