import {
  CONFIRM_RESEARCH_IMAGES,
  resolveMaxImages,
  resolveResearchImageScope,
  type ResearchImageScope,
} from "./config";

export type ResearchImageArgs = {
  dryRun: boolean;
  scope: ResearchImageScope;
  maxImages: number | "ALL";
  confirm: string;
};

export function parseResearchImageArgs(argv: readonly string[]): ResearchImageArgs {
  let write = false;
  let dryRunFlag = false;
  let scope = "all_missing";
  let maxImages = "10";
  let confirm = "";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRunFlag = true;
      continue;
    }
    if (arg === "--write") {
      write = true;
      continue;
    }
    if (arg === "--scope") {
      scope = readValue(argv, index, "--scope");
      index += 1;
      continue;
    }
    if (arg.startsWith("--scope=")) {
      scope = arg.slice("--scope=".length);
      continue;
    }
    if (arg === "--max-images") {
      maxImages = readValue(argv, index, "--max-images");
      index += 1;
      continue;
    }
    if (arg.startsWith("--max-images=")) {
      maxImages = arg.slice("--max-images=".length);
      continue;
    }
    if (arg === "--confirm") {
      confirm = readValue(argv, index, "--confirm");
      index += 1;
      continue;
    }
    if (arg.startsWith("--confirm=")) {
      confirm = arg.slice("--confirm=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (write && dryRunFlag) {
    throw new Error("Pass either --dry-run or --write, not both.");
  }
  if (write && confirm !== CONFIRM_RESEARCH_IMAGES) {
    throw new Error(
      "Refusing to write. confirm_write must be exactly GENERATE RESEARCH IMAGES. Nothing was generated or written.",
    );
  }

  return {
    dryRun: !write,
    scope: resolveResearchImageScope(scope),
    maxImages: resolveMaxImages(maxImages),
    confirm,
  };
}

function readValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}
