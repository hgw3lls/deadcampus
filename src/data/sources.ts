export type SourceRegistryEntry = {
  id: string;
  label: string;
  path?: string;
  description: string;
};

export const sourceRegistry: SourceRegistryEntry[] = [
  {
    id: "master-workbook",
    label: "DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx",
    path: "DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx",
    description: "Primary workbook used by the preprocessing script."
  },
  {
    id: "normalized-sites",
    label: "Normalized campus sites",
    path: "public/data/sites.json",
    description: "Generated client-facing campus records. Preserve this as build output, not hand-authored data."
  },
  {
    id: "research-queue",
    label: "Research queue",
    path: "public/data/research_queue.json",
    description: "Generated records with missing fields and computed research priority score."
  },
  {
    id: "staging-queue",
    label: "Promotion staging queue",
    path: "public/data/queue.json",
    description: "Hand-authored or imported staging records that can be promoted into canonical sites.json."
  },
  {
    id: "promotion-log",
    label: "Promotion log",
    path: "public/data/promotion-log.json",
    description: "Append-only log written by scripts/promoteQueue.js."
  },
  {
    id: "network-edges",
    label: "Ownership/network edges",
    path: "public/data/edges.json",
    description: "Generated edge list from workbook network sheets."
  },
  {
    id: "evidence-slices",
    label: "Evidence wall slices",
    path: "public/data/graph_index.json",
    description: "Generated case-board index and focused graph slice files under public/data/graphs."
  }
];
