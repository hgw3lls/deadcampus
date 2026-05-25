import type { StatusCode } from "@/lib/data";

export type AtlasTextCategory =
  | "intro_manifesto"
  | "closure_fragments"
  | "status_code_texts"
  | "fieldwork_notes"
  | "replacement_economy"
  | "map_interstitials"
  | "micro_captions";

export type AtlasTextBlock = {
  id: string;
  title: string;
  category: AtlasTextCategory;
  body: string;
  tags?: string[];
};

export const atlasTexts: AtlasTextBlock[] = [
  {
    id: "campus-did-not-disappear",
    title: "The Campus Did Not Disappear",
    category: "intro_manifesto",
    tags: ["manifesto", "asset-transfer", "afterlife"],
    body: `The campus did not disappear.

It changed jurisdiction.

The library became a server room.
The dormitory became debt storage.
The theology building became administrative overflow.
The student union became a regional healthcare annex.
The athletic field became speculative acreage waiting for demographic correction.

Education did not collapse.

It was reformatted into asset classes.`
  },
  {
    id: "abandoned-logistics-network",
    title: "Abandoned Logistics Network of Cognition",
    category: "map_interstitials",
    tags: ["territory", "withdrawal", "map"],
    body: `The twentieth century scattered cognition territorially.

Small colleges.
Branch campuses.
Extension centers.
Night schools.
Rural seminaries.
Municipal annexes.
Satellite classrooms hidden in office parks and dead malls.

A continental nervous system.

Then the withdrawal began.

Not dramatic.
Administrative.

Enrollment compression.
Deferred maintenance.
Strategic consolidation.
Asset optimization.
Program suspension.
Emergency teach-outs.

The map did not explode.

It thinned.`
  },
  {
    id: "closure-notice",
    title: "Closure Notice",
    category: "closure_fragments",
    tags: ["administration", "closure-language"],
    body: `The language is always soft at first.

Realignment.
Transition.
Strategic repositioning.
Adaptive reuse.
Mission evolution.

No institution ever says:
the territory can no longer support thought here.`
  },
  {
    id: "retreat-of-thought",
    title: "The Retreat of Thought",
    category: "intro_manifesto",
    tags: ["neoliberalism", "geography", "infrastructure"],
    body: `For over a century, the United States distributed cognition physically across territory.

The campus was not merely a school.
It was an infrastructural promise:
that intelligence would remain geographically dispersed.

A small town could contain a laboratory.
A rural county could contain philosophy.
A commuter annex could contain literature.
A monastery could contain chemistry.

Dead Campus Atlas documents the reversal of that promise.

Under neoliberal optimization, educational space no longer needs to remain territorially distributed. Knowledge becomes centralized while its physical infrastructure is liquidated.

The campus survives only where it can justify itself as:
research capital,
security infrastructure,
real-estate leverage,
or computational utility.

The rest enters withdrawal.

This is not simply an educational crisis.
It is a geographic restructuring of who is permitted proximity to thought.`
  },
  {
    id: "parcel-theory",
    title: "Parcel Theory",
    category: "replacement_economy",
    tags: ["parcelization", "cadastral", "ownership"],
    body: `A campus dies twice.

First institutionally.
Then spatially.

The first death is administrative:
merger,
closure,
accreditation collapse,
financial emergency.

The second death is cadastral.

Parcel division.
Auction subdivision.
Utility reassignment.
Road abandonment.
Tax remapping.

The university ceases to exist not when classes stop,
but when the territory can no longer remember itself as a single thing.`
  },
  {
    id: "status-active-risk",
    title: "ACTIVE-RISK",
    category: "status_code_texts",
    tags: ["ACTIVE-RISK"],
    body: `The institution remains operational while all long-term assumptions have already failed.

Students continue arriving inside a structure already preparing for its own afterlife.`
  },
  {
    id: "status-closure-event",
    title: "CLOSURE-EVENT",
    category: "status_code_texts",
    tags: ["CLOSURE-EVENT"],
    body: `The administrative act has crossed into public record.

Teach-out, termination, merger, or revocation becomes a spatial event.`
  },
  {
    id: "status-asset-transfer",
    title: "ASSET-TRANSFER",
    category: "status_code_texts",
    tags: ["ASSET-TRANSFER"],
    body: `The school becomes a transaction before it becomes a ruin.

Control moves faster than memory.`
  },
  {
    id: "status-cloud",
    title: "CLOUD",
    category: "status_code_texts",
    tags: ["CLOUD"],
    body: `Educational infrastructure converted into computational infrastructure.

The classroom disappears into invisible labor performed by air conditioning systems.

The new campus has no students.
Only redundancy protocols.`
  },
  {
    id: "status-security",
    title: "SECURITY",
    category: "status_code_texts",
    tags: ["SECURITY"],
    body: `The educational territory survives.
Its civic function does not.

The lecture hall remains intact.
The parking lots remain intact.
The perimeter remains intact.

Only the population changes.`
  },
  {
    id: "status-parcelized",
    title: "PARCELIZED",
    category: "status_code_texts",
    tags: ["PARCELIZED"],
    body: `The university survives only as disconnected legal fragments.

Athletics owned by one entity.
Dormitories by another.
Administration by another.
The chapel leased seasonally.
The library condemned.

An epistemology shattered into deeds.`
  },
  {
    id: "status-ruin",
    title: "RUIN",
    category: "status_code_texts",
    tags: ["RUIN"],
    body: `No replacement order has stabilized the site.

The campus remains legible as failure, vacancy, insurance problem, and weather exposure.`
  },
  {
    id: "status-counter-use",
    title: "COUNTER-USE",
    category: "status_code_texts",
    tags: ["COUNTER-USE"],
    body: `The territory is reoccupied against the extraction logic.

Afterlife becomes civic, improvised, mutual, or educational again under another name.`
  },
  {
    id: "field-recording-notes",
    title: "Field Recording Notes",
    category: "fieldwork_notes",
    tags: ["fieldwork", "signage", "residue"],
    body: `Hallway fluorescent hum persists after institutional termination.

Wayfinding systems remain active years after closure.

Directional arrows continue directing populations that no longer exist.

Observed phenomenon:
campus maps possess longer life expectancy than academic departments.`
  },
  {
    id: "administrative-residue",
    title: "Administrative Residue",
    category: "fieldwork_notes",
    tags: ["bureaucracy", "paperwork", "method"],
    body: `The final layer of a dying institution is always bureaucratic.

Not books.
Not students.

Forms.

Maintenance requests.
Deferred roofing assessments.
Emergency budget PDFs.
Accreditation correspondence.
Strategic transformation reports.

The civilization leaves paperwork behind before it leaves architecture.`
  },
  {
    id: "campus-weather-system",
    title: "The Campus Weather System",
    category: "replacement_economy",
    tags: ["cloud", "security", "infrastructure"],
    body: `Certain campuses generate their own climate after closure.

Negative pressure buildings.
Cold corridors.
Dust circulation patterns.
Server-room heat blooms.
Windowless annexes sustaining permanent fluorescent noon.

Entire educational regions now operate as artificial weather systems for data storage, policing, and logistical management.

The students are gone.

The infrastructure continues thinking anyway.`
  },
  {
    id: "afterlife-of-educational-land",
    title: "The Afterlife of Educational Land",
    category: "replacement_economy",
    tags: ["afterlife", "replacement-economy", "reuse"],
    body: `A closed university rarely becomes empty.

It becomes haunted by replacement logic.

The theology school becomes luxury senior housing.
The biology lab becomes defense subcontracting space.
The dormitory becomes migrant intake overflow.
The commuter annex becomes cloud infrastructure.
The student parking lot becomes distribution staging.

The land remains pedagogical.

It simply teaches a different civilization.`
  },
  {
    id: "micro-caption-01",
    title: "Micro Caption 01",
    category: "micro_captions",
    tags: ["caption"],
    body: "The institution closed years before the buildings admitted it."
  },
  {
    id: "micro-caption-02",
    title: "Micro Caption 02",
    category: "micro_captions",
    tags: ["caption"],
    body: "Every abandoned campus already contains its replacement economy."
  },
  {
    id: "micro-caption-03",
    title: "Micro Caption 03",
    category: "micro_captions",
    tags: ["caption"],
    body: "A lecture hall is only a warehouse with ideological lighting."
  },
  {
    id: "micro-caption-04",
    title: "Micro Caption 04",
    category: "micro_captions",
    tags: ["caption"],
    body: "The campus survives as zoning memory."
  },
  {
    id: "micro-caption-05",
    title: "Micro Caption 05",
    category: "micro_captions",
    tags: ["caption"],
    body: "Deferred maintenance is a political philosophy."
  },
  {
    id: "micro-caption-06",
    title: "Micro Caption 06",
    category: "micro_captions",
    tags: ["caption"],
    body: "Universities now dissolve in spreadsheet form before physical form."
  },
  {
    id: "micro-caption-07",
    title: "Micro Caption 07",
    category: "micro_captions",
    tags: ["caption"],
    body: "The future arrives first as a facilities report."
  },
  {
    id: "micro-caption-08",
    title: "Micro Caption 08",
    category: "micro_captions",
    tags: ["caption"],
    body: "Educational withdrawal produces logistical surplus."
  },
  {
    id: "micro-caption-09",
    title: "Micro Caption 09",
    category: "micro_captions",
    tags: ["caption"],
    body: "The map of closed campuses resembles a nervous system forgetting extremities."
  },
  {
    id: "micro-caption-10",
    title: "Micro Caption 10",
    category: "micro_captions",
    tags: ["caption"],
    body: "The American university is becoming coastal, securitized, computational, and private."
  },
  {
    id: "micro-caption-11",
    title: "Micro Caption 11",
    category: "micro_captions",
    tags: ["caption"],
    body: "Empty dormitories are climate-controlled waiting rooms for capital."
  },
  {
    id: "micro-caption-12",
    title: "Micro Caption 12",
    category: "micro_captions",
    tags: ["caption"],
    body: "The neoliberal university no longer expands territorially. It consolidates vertically."
  }
];

export const atlasTextsById = atlasTexts.reduce<Record<string, AtlasTextBlock>>((lookup, text) => {
  lookup[text.id] = text;
  return lookup;
}, {});

export const microCaptions = atlasTexts.filter((text) => text.category === "micro_captions");

export const statusCodeTextByCode = atlasTexts
  .filter((text) => text.category === "status_code_texts")
  .reduce<Partial<Record<StatusCode, AtlasTextBlock>>>((lookup, text) => {
    const code = text.tags?.find((tag): tag is StatusCode =>
      ["ACTIVE-RISK", "CLOSURE-EVENT", "ASSET-TRANSFER", "PARCELIZED", "CLOUD", "SECURITY", "RUIN", "COUNTER-USE"].includes(tag)
    );
    if (code) lookup[code] = text;
    return lookup;
  }, {});

export function getAtlasText(id: string): AtlasTextBlock {
  const text = atlasTextsById[id];
  if (!text) {
    throw new Error(`Atlas text not found: ${id}`);
  }
  return text;
}

export function deterministicMicroCaption(seed: string): AtlasTextBlock {
  const captions = microCaptions.length ? microCaptions : atlasTexts;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return captions[hash % captions.length];
}
