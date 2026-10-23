import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { GA_MEASUREMENT_ID } from "./site";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function readProject(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function sourceFiles(relativeDir: string): string[] {
  const directory = join(projectRoot, relativeDir);
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(relativePath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      files.push(relativePath);
    }
  }
  return files;
}

function request(path: string, headers?: HeadersInit): NextRequest {
  return new NextRequest(new URL(path, "https://www.snacksmate.com"), { headers });
}

function redirectTarget(path: string, headers?: HeadersInit): URL {
  const response = proxy(request(path, headers));
  assert.equal(response.status, 307);
  const location = response.headers.get("location");
  assert.ok(location);
  const target = new URL(location, "https://www.snacksmate.com");
  const body = response.body;
  assert.equal(body, null);
  return target;
}

test("the root request is a locale redirect and not an HTML language gate", () => {
  const response = proxy(request("/"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("content-type"), null);
  assert.equal(response.body, null);
  const location = response.headers.get("location");
  assert.ok(location);
  assert.equal(new URL(location, "https://www.snacksmate.com").pathname, "/en/");

  const rootPage = readProject("app/(root)/page.tsx");
  const rootLayout = readProject("app/(root)/layout.tsx");
  assert.match(rootPage, /redirect\(/);
  assert.equal(/<html|<body|<a\b|<Link\b|<script\b/.test(rootPage), false);
  for (const source of [rootPage, rootLayout]) {
    assert.equal(/noscript|location\.replace/.test(source), false);
  }
});

test("root redirect follows the cookie and Accept-Language and keeps the query", () => {
  assert.equal(redirectTarget("/").pathname, "/en/");
  assert.equal(
    redirectTarget("/", { "accept-language": "he-IL,he;q=0.9" }).pathname,
    "/he/",
  );
  assert.equal(
    redirectTarget("/", { "accept-language": "en-US,en;q=0.9,he;q=0.2" }).pathname,
    "/he/",
  );
  assert.equal(
    redirectTarget("/", {
      cookie: "snacksmate_lang=he",
      "accept-language": "en-US,en;q=0.9",
    }).pathname,
    "/he/",
  );
  assert.equal(
    redirectTarget("/", {
      cookie: "snacksmate_lang=en",
      "accept-language": "he-IL,he;q=0.9",
    }).pathname,
    "/en/",
  );

  const target = redirectTarget("/?utm_source=newsletter&utm_medium=email", {
    cookie: "snacksmate_lang=he",
  });
  assert.equal(target.pathname, "/he/");
  assert.equal(target.searchParams.get("utm_source"), "newsletter");
  assert.equal(target.searchParams.get("utm_medium"), "email");

  const englishTarget = redirectTarget("/?ref=home");
  assert.equal(englishTarget.pathname, "/en/");
  assert.equal(englishTarget.searchParams.get("ref"), "home");
});

test("locale pages keep one shared Google Analytics tag and the root does not add another", () => {
  assert.equal(GA_MEASUREMENT_ID, "G-M5N9063WNQ");

  const analytics = readProject("components/GoogleAnalytics.tsx");
  assert.equal(
    analytics.match(/googletagmanager\.com\/gtag\/js\?id=\$\{GA_MEASUREMENT_ID\}/g)?.length,
    1,
  );
  assert.equal(analytics.match(/gtag\('config', '\$\{GA_MEASUREMENT_ID\}'\)/g)?.length, 1);

  const localeLayout = readProject("app/[lang]/layout.tsx");
  assert.equal(localeLayout.match(/<GoogleAnalytics\s*\/>/g)?.length, 1);
  assert.match(localeLayout, /from "@\/components\/GoogleAnalytics"/);

  const appSources = sourceFiles("app");
  const rendersAnalytics = appSources.filter((file) =>
    readProject(file).includes("<GoogleAnalytics"),
  );
  assert.deepEqual(rendersAnalytics, ["app/[lang]/layout.tsx"]);

  for (const file of ["app/(root)/layout.tsx", "app/(root)/page.tsx", "proxy.ts"]) {
    const source = readProject(file);
    assert.equal(source.includes("GoogleAnalytics"), false, file);
    assert.equal(source.includes("googletagmanager"), false, file);
    assert.equal(source.includes("gtag("), false, file);
    assert.equal(source.includes(GA_MEASUREMENT_ID), false, file);
  }
});
