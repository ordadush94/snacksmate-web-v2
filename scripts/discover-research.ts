import { resolveLookbackDays } from "../lib/research-discovery/config";
import {
  assertDiscoveryConfig,
  PubmedUnavailableError,
  runResearchDiscovery,
} from "../lib/research-discovery/run";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let lookback: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--lookback-days") {
      lookback = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--lookback-days=")) {
      lookback = arg.slice("--lookback-days=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    dryRun,
    lookbackDays: resolveLookbackDays(lookback ?? process.env.RESEARCH_LOOKBACK_DAYS),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = {
    email: process.env.NCBI_CONTACT_EMAIL?.trim(),
    token: process.env.SANITY_WRITE_TOKEN?.trim(),
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim(),
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET?.trim(),
  };
  assertDiscoveryConfig(config);

  await runResearchDiscovery({
    dryRun: args.dryRun,
    lookbackDays: args.lookbackDays,
    email: config.email,
    apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
    sanity: {
      projectId: config.projectId,
      dataset: config.dataset,
      apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
      token: config.token,
    },
  });
}

main().catch((error: unknown) => {
  if (error instanceof PubmedUnavailableError) {
    console.error(`PubMed is unavailable. ${error.message}`);
    process.exit(1);
  }
  const message = error instanceof Error ? error.message : "Research discovery failed.";
  console.error(message);
  process.exit(1);
});
