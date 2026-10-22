import assert from "node:assert/strict";
import test from "node:test";
import {
  isHebrewLanguageTag,
  localeFromAcceptLanguage,
  localeHomePath,
  preferredLocale,
} from "./language";

test("cookie choice wins over Accept-Language", () => {
  assert.equal(
    preferredLocale({ cookie: "he", acceptLanguage: "en-US,en;q=0.9" }),
    "he",
  );
  assert.equal(
    preferredLocale({ cookie: "en", acceptLanguage: "he-IL,he;q=0.9" }),
    "en",
  );
});

test("an invalid cookie falls through to Accept-Language", () => {
  assert.equal(
    preferredLocale({ cookie: "fr", acceptLanguage: "he-IL,en;q=0.8" }),
    "he",
  );
  assert.equal(preferredLocale({ cookie: "HE", acceptLanguage: "en" }), "en");
});

test("Hebrew anywhere in Accept-Language selects Hebrew", () => {
  assert.equal(localeFromAcceptLanguage("he"), "he");
  assert.equal(localeFromAcceptLanguage("he-IL,en;q=0.8"), "he");
  assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9,he;q=0.2"), "he");
  assert.equal(isHebrewLanguageTag("he-IL"), true);
});

test("missing or non-Hebrew language tags default to English", () => {
  assert.equal(preferredLocale({ cookie: null, acceptLanguage: null }), "en");
  assert.equal(preferredLocale({ cookie: undefined, acceptLanguage: "" }), "en");
  assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9"), "en");
  assert.equal(localeFromAcceptLanguage("hebrew,en;q=0.8"), "en");
  assert.equal(isHebrewLanguageTag("hebrew"), false);
});

test("locale home paths keep the trailing slash and query string", () => {
  assert.equal(localeHomePath("en"), "/en/");
  assert.equal(localeHomePath("he", "?utm_source=newsletter"), "/he/?utm_source=newsletter");
  assert.equal(localeHomePath("en", "utm_source=newsletter"), "/en/?utm_source=newsletter");
  assert.equal(localeHomePath("en", "?"), "/en/");
});
