import type { AtlasExplorerSite } from "@/lib/atlasExplorer";

export type NormalizedCampusSite = AtlasExplorerSite & {
  region: string;
  afterlifeCategory: string;
  afterlifeDescription: string | null;
  ownershipType: string | null;
  sourceNotes: string | null;
  sourceUrls: string[];
  relatedEntities: string[];
  confidence: "confirmed" | "derived" | "inferred" | "unknown";
};

/*
  Raw data is generated from the workbook into public/data/*.json by scripts/preprocessWorkbook.ts.
  Do not hand-edit public/data/sites.json, public/data/edges.json, or public/data/graphs/*.json.

  public/data/queue.json is the staging queue for new uncertain records. Promote records from that file into
  public/data/sites.json with npm run promote:queue, then validate with npm run validate:data.

  NormalizedCampusSite is the stable interface future route components should target.
  src/lib/loadCampusData.ts adapts generated SiteRecord rows into this shape at runtime.
*/
export const campusSiteSchemaExample: NormalizedCampusSite = {
  id: "example-campus",
  accession: "DCA-000000",
  name: "Example Campus",
  institution: "Example Institution",
  city: "Example City",
  state: "EX",
  region: "Unknown",
  latitude: null,
  longitude: null,
  institutionType: "Unknown",
  sector: "Unknown",
  control: null,
  closureYear: null,
  decade: "Unknown",
  statusCode: "CLOSURE-EVENT",
  afterlife: null,
  afterlifeCategory: "unknown",
  afterlifeDescription: null,
  afterlifeFunction: "parcelized real estate",
  buyer: null,
  owner: null,
  ownershipType: null,
  originalFunction: "campus",
  source: null,
  sourceNotes: null,
  sourceUrls: [],
  relatedEntities: [],
  confidence: "unknown",
  sourceRecord: {}
};
