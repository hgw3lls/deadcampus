"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { FilterState, SiteRecord } from "@/lib/data";
import { STATUS_COLORS, STATUS_LABELS, compactNumber, formatNumber } from "@/lib/data";

type LeafletModule = typeof import("leaflet");

type MapPanelProps = {
  sites: SiteRecord[];
  selectedSiteId: string | null;
  onSelectSite: (site: SiteRecord) => void;
  atlasPlate?: boolean;
  fill?: boolean;
  filters?: FilterState;
  generatedAt?: string;
};

export function MapPanel({ sites, selectedSiteId, onSelectSite, atlasPlate = false, fill = false, filters, generatedAt }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const lastFitKeyRef = useRef("");
  const leafletRef = useRef<LeafletModule | null>(null);
  const [mappedCount, setMappedCount] = useState(0);

  const coordinateSites = useMemo(
    () => sites.filter((site) => site.latitude !== null && site.longitude !== null),
    [sites]
  );
  const compactPlate = atlasPlate && fill;

  useEffect(() => {
    let cancelled = false;

    async function renderMap() {
      if (!containerRef.current) return;
      const L = leafletRef.current ?? (await import("leaflet"));
      leafletRef.current = L;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          preferCanvas: true,
          zoomControl: false,
          attributionControl: true,
          minZoom: 3,
          maxZoom: 12
        }).setView([39.5, -98.35], 4);

        L.control.zoom({ position: "topright" }).addTo(mapRef.current);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          opacity: 0.72,
          attribution: "&copy; OpenStreetMap &copy; CARTO"
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      layerRef.current?.clearLayers();
      const bounds: Array<[number, number]> = [];

      coordinateSites.forEach((site) => {
        if (site.latitude === null || site.longitude === null) return;
        const selected = site.id === selectedSiteId;
        const marker = L.marker([site.latitude, site.longitude], {
          icon: L.divIcon({
            className: "atlas-marker-shell",
            iconSize: atlasPlate ? [28, 28] : [22, 22],
            iconAnchor: atlasPlate ? [14, 14] : [11, 11],
            html: markerHtml(site, selected, atlasPlate)
          }),
          keyboard: false,
          riseOnHover: true,
          zIndexOffset: selected ? 1000 : site.campusMarker === "curated" ? 400 : 0
        });
        marker.bindTooltip(
          `<strong>${escapeHtml(site.name)}</strong><br>${escapeHtml([site.city, site.state].filter(Boolean).join(", "))}<br>${site.closureYear ?? "year unknown"} / ${escapeHtml(site.statusCode)}`,
          { direction: "top", sticky: true }
        );
        marker.on("click", () => onSelectSite(site));
        marker.addTo(layerRef.current!);
        bounds.push([site.latitude, site.longitude]);
      });

      setMappedCount(coordinateSites.length);
      const fitKey = coordinateSites.map((site) => site.id).join("|");
      if (lastFitKeyRef.current !== fitKey && bounds.length > 1) {
        mapRef.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 5 });
        lastFitKeyRef.current = fitKey;
      } else if (lastFitKeyRef.current !== fitKey && bounds.length === 1) {
        mapRef.current.setView(bounds[0], 7);
        lastFitKeyRef.current = fitKey;
      }
    }

    renderMap();
    window.setTimeout(() => mapRef.current?.invalidateSize(), 100);
    return () => {
      cancelled = true;
    };
  }, [atlasPlate, coordinateSites, onSelectSite, selectedSiteId]);

  return (
    <section
      className={`atlas-panel relative flex flex-col overflow-hidden ${
        fill ? "h-full min-h-0" : "min-h-[520px]"
      } ${
        atlasPlate && !fill ? "atlas-plate min-h-[calc(100vh-156px)]" : atlasPlate ? "atlas-plate" : ""
      }`}
    >
      <div className={`flex items-start justify-between border-b border-atlas-ink bg-atlas-paper p-3 ${atlasPlate && !fill ? "atlas-plate-header" : ""}`}>
        <div>
          <div className="atlas-label text-atlas-muted">{atlasPlate ? "Plate DC-A01 / national retreat map" : "National retreat map"}</div>
          <h2 className={`${atlasPlate ? (compactPlate ? "text-xl md:text-2xl" : "text-2xl md:text-4xl") : "text-xl"} font-black uppercase leading-tight`}>
            Spatialized Campus Closure Record
          </h2>
          {atlasPlate && !compactPlate ? (
            <div className="mt-1 font-mono text-[10px] uppercase text-atlas-muted">
              Bureau of educational land afterlives / closure, transfer, parcelization, cloud, security
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 border border-atlas-ink font-mono text-[11px] uppercase">
          <div className="border-r border-atlas-ink px-3 py-2">
            <div className="text-atlas-muted">Filtered</div>
            <div className="text-base font-black">{compactNumber(sites.length)}</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-atlas-muted">Mapped</div>
            <div className="text-base font-black">{formatNumber(mappedCount)}</div>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
      {atlasPlate ? (
        <PlateOverlays sites={sites} mappedCount={mappedCount} filters={filters} generatedAt={generatedAt} />
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-3 border border-atlas-ink bg-atlas-paper/95 p-2 font-mono text-[10px] uppercase">
          <div className="mb-1 font-black">Marker class</div>
          <div>Main / branch / PEPS / curated cases</div>
          <div>Color = computed status code</div>
        </div>
      )}
    </section>
  );
}

function markerHtml(site: SiteRecord, selected: boolean, atlasPlate: boolean) {
  const markerClass = `atlas-map-glyph atlas-map-glyph--${site.campusMarker} ${atlasPlate ? "atlas-map-glyph--plate" : ""} ${
    selected ? "atlas-map-glyph--selected" : ""
  }`;
  const color = STATUS_COLORS[site.statusCode];
  const label = escapeHtml(site.campusMarker.toUpperCase().slice(0, 2));
  return `<span class="${markerClass}" style="--marker-color:${color}" aria-label="${label}"></span>`;
}

function PlateOverlays({
  sites,
  mappedCount,
  filters,
  generatedAt
}: {
  sites: SiteRecord[];
  mappedCount: number;
  filters?: FilterState;
  generatedAt?: string;
}) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[450] atlas-plate-grid" />
      <div className="pointer-events-none absolute left-4 top-24 z-[500] max-w-[360px] border border-atlas-ink bg-atlas-paper/90 p-3 font-mono uppercase">
        <div className="atlas-label text-atlas-muted">Map plate index</div>
        <div className="mt-1 text-2xl font-black leading-none">DC-A01</div>
        <div className="mt-2 text-[10px] leading-4">
          All visible sites are filtered records from the master workbook. Symbol shape marks campus class. Color marks computed status.
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] grid max-w-[470px] grid-cols-2 border border-atlas-ink bg-atlas-paper/92 font-mono text-[10px] uppercase md:grid-cols-4">
        <GlyphLegend label="Main campus" marker="main" />
        <GlyphLegend label="Branch site" marker="branch" />
        <GlyphLegend label="PEPS record" marker="peps" />
        <GlyphLegend label="Curated case" marker="curated" />
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 z-[500] w-[300px] border border-atlas-ink bg-atlas-paper/92 font-mono text-[10px] uppercase">
        <div className="border-b border-atlas-ink p-2">
          <div className="atlas-label text-atlas-muted">Plate stamp</div>
          <div className="mt-1 font-black">Filtered records: {formatNumber(sites.length)}</div>
          <div className="font-black">Spatialized records: {formatNumber(mappedCount)}</div>
          <div>Generated: {generatedAt ? new Date(generatedAt).toLocaleDateString() : "runtime"}</div>
        </div>
        <div className="border-b border-atlas-ink p-2">
          <div className="atlas-label text-atlas-muted">Active filter stamp</div>
          <div className="mt-1 leading-4">{activeFilterStamp(filters)}</div>
        </div>
        <div className="grid grid-cols-2">
          {STATUS_LABELS.map((status) => (
            <div key={status.key} className="flex items-center gap-2 border-b border-r border-atlas-ink px-2 py-1">
              <span className="h-2.5 w-2.5 border border-atlas-ink" style={{ background: STATUS_COLORS[status.key] }} />
              <span>{status.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[450] border-t border-atlas-ink/30" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[450] border-l border-atlas-ink/30" />
    </>
  );
}

function GlyphLegend({ label, marker }: { label: string; marker: SiteRecord["campusMarker"] }) {
  return (
    <div className="flex items-center gap-2 border-b border-r border-atlas-ink p-2">
      <span className={`atlas-map-glyph atlas-map-glyph--${marker} atlas-map-glyph--legend`} style={{ "--marker-color": "#111111" } as CSSProperties} />
      <span>{label}</span>
    </div>
  );
}

function activeFilterStamp(filters?: FilterState) {
  if (!filters) return "No active filter declaration.";
  const active = [
    filters.query ? `query=${filters.query}` : null,
    filters.yearMin !== null || filters.yearMax !== null ? `years=${filters.yearMin ?? "min"}-${filters.yearMax ?? "max"}` : null,
    filters.state !== "ALL" ? `state=${filters.state}` : null,
    filters.morphology !== "ALL" ? `morphology=${filters.morphology}` : null,
    filters.sector !== "ALL" ? `sector=${filters.sector}` : null,
    filters.campusType !== "ALL" ? `campus=${filters.campusType}` : null,
    filters.afterlifeStatus !== "ALL" ? `afterlife=${filters.afterlifeStatus}` : null,
    filters.statusCode !== "ALL" ? `status=${filters.statusCode}` : null,
    filters.researchPriority !== "ALL" ? `priority=${filters.researchPriority}` : null,
    filters.coordinatesOnly ? "coordinates=only" : null
  ].filter(Boolean);

  return active.length ? active.join(" / ") : "national extract / no filters active";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}
