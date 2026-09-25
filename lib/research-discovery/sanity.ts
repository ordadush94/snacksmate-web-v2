import { createClient, type SanityClient } from "@sanity/client";

import { findDuplicate, type ResearchIdentity } from "./dedupe";
import type { ResearchDraft } from "./draft";

const IDENTIFIERS_QUERY = `*[_type == "research"]{
  "id": _id,
  pmid,
  doi,
  title,
  "slug": slug.current
}`;

export function createSanityWriteClient(input: {
  projectId: string;
  dataset: string;
  apiVersion: string;
  token: string;
}): SanityClient {
  return createClient({
    projectId: input.projectId,
    dataset: input.dataset,
    apiVersion: input.apiVersion,
    token: input.token,
    useCdn: false,
    perspective: "raw",
  });
}

export async function loadResearchIdentities(
  client: SanityClient,
): Promise<ResearchIdentity[]> {
  const rows = await client.fetch<ResearchIdentity[]>(IDENTIFIERS_QUERY);
  return rows.filter((row) => row.id);
}

export async function createResearchDraft(
  client: SanityClient,
  draft: ResearchDraft,
): Promise<"created" | "duplicate"> {
  try {
    await client.create(draft);
    return "created";
  } catch (error) {
    if (isConflict(error)) return "duplicate";
    throw error;
  }
}

export function duplicateOf(
  draft: ResearchDraft,
  existing: readonly ResearchIdentity[],
) {
  return findDuplicate(
    {
      id: draft._id,
      pmid: draft.pmid,
      doi: draft.doi,
      title: draft.title,
      slug: draft.slug.current,
    },
    existing,
  );
}

function isConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const statusCode = "statusCode" in error ? error.statusCode : undefined;
  return statusCode === 409;
}
