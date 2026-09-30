import { parseBackfillArgs } from "../lib/research-backfill/args";
import { enrichBackfillDrafts } from "../lib/research-backfill/enrich";
import { formatBackfillReport, formatBackfillWriteReport } from "../lib/research-backfill/report";
import { runResearchBackfill } from "../lib/research-backfill/run";
import { assertDiscoveryConfig, PubmedUnavailableError } from "../lib/research-discovery/run";

async function main() {
  const args = parseBackfillArgs(process.argv.slice(2));
  const config = {
    email: process.env.NCBI_CONTACT_EMAIL?.trim(),
    token: process.env.SANITY_WRITE_TOKEN?.trim(),
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim(),
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET?.trim(),
  };
  assertDiscoveryConfig(config);

  const result = await runResearchBackfill({
    dryRun: args.dryRun,
    enrich: args.enrich,
    enrichAfterWrite: args.enrich ? enrichBackfillDrafts : undefined,
    from: args.from,
    to: args.to,
    limit: args.limit,
    email: config.email,
    apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
    sanity: {
      projectId: config.projectId,
      dataset: config.dataset,
      apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
      token: config.token,
    },
  });

  console.log(result.dryRun ? formatBackfillReport(result) : formatBackfillWriteReport(result));
  if (!result.dryRun && (result.enrichment === "failed" || result.writeAborted)) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  if (error instanceof PubmedUnavailableError) {
    console.error(`PubMed is unavailable. ${error.message}`);
    process.exit(1);
  }
  const message = error instanceof Error ? error.message : "Research backfill failed.";
  console.error(message);
  process.exit(1);
});
