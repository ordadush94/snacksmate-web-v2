import assert from "node:assert/strict";
import test from "node:test";

import { parsePubmedFetchXml } from "./pubmed";

const ERRATUM_XML = `<?xml version="1.0" ?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">42746144</PMID>
      <Article>
        <Journal>
          <Title>Front Public Health</Title>
          <JournalIssue>
            <PubDate><Year>2026</Year><Month>Sep</Month><Day>1</Day></PubDate>
          </JournalIssue>
        </Journal>
        <ArticleTitle>Correction: Effects of weekly exercise snacks on fitness.</ArticleTitle>
        <Abstract>
          <AbstractText Label="Objective">This notice corrects the original trial.</AbstractText>
        </Abstract>
        <AuthorList>
          <Author><LastName>Doe</LastName><ForeName>Ann</ForeName></Author>
        </AuthorList>
        <PublicationTypeList>
          <PublicationType UI="D016425">Published Erratum</PublicationType>
        </PublicationTypeList>
      </Article>
      <CommentsCorrectionsList>
        <CommentsCorrections RefType="ErratumFor">
          <RefSource>Front Public Health. 2026 Jul 15;14:1846870.</RefSource>
          <PMID Version="1">42529115</PMID>
        </CommentsCorrections>
      </CommentsCorrectionsList>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

test("reads the original PMID from an erratum record", () => {
  const parsed = parsePubmedFetchXml(ERRATUM_XML);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.records.length, 1);
  const record = parsed.records[0];
  assert.equal(record?.pmid, "42746144");
  assert.deepEqual(record?.publicationTypes, ["Published Erratum"]);
  assert.deepEqual(record?.commentCorrections, [
    { refType: "ErratumFor", pmid: "42529115" },
  ]);
});
