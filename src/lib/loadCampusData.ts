import { regionForState } from "@/src/data/regions";
import type { NormalizedCampusSite } from "@/src/data/campusSites";
import { normalizeAtlasExplorerSites, type AtlasExplorerSite } from "@/lib/atlasExplorer";
import { loadAtlasData, type AtlasData, type SiteRecord } from "@/lib/data";

export async function loadCampusData(): Promise<{ atlas: AtlasData; campusSites: NormalizedCampusSite[] }> {
  const atlas = await loadAtlasData();
  return {
    atlas,
    campusSites: normalizeCampusSites(atlas.sites)
  };
}

export function normalizeCampusSites(sites: SiteRecord[]): NormalizedCampusSite[] {
  return normalizeAtlasExplorerSites(sites).map((site) => extendCampusSite(site));
}

export function extendCampusSite(site: AtlasExplorerSite): NormalizedCampusSite {
  const sourceRecord = site.sourceRecord as SiteRecord;
  const sourceUrls = site.source ? [site.source] : [];
  const relatedEntities = [site.buyer, site.owner, site.afterlife, sourceRecord?.rootOpeid6].filter(Boolean) as string[];

  return {
    ...site,
    region: regionForState(site.state),
    afterlifeCategory: site.afterlifeFunction,
    afterlifeDescription: site.afterlife,
    ownershipType: site.buyer || site.owner ? "controller-recorded" : "unresolved",
    sourceNotes: sourceRecord?.notes ?? site.source ?? null,
    sourceUrls,
    relatedEntities,
    confidence: sourceRecord?.verification ? "confirmed" : sourceRecord?.sourceUrl ? "derived" : "unknown"
  };
}
