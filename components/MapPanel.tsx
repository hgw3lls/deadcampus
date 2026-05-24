"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteRecord } from "@/lib/data";
import { STATUS_COLORS, compactNumber, formatNumber } from "@/lib/data";

type LeafletModule = typeof import("leaflet");

type MapPanelProps = {
  sites: SiteRecord[];
  selectedSiteId: string | null;
  onSelectSite: (site: SiteRecord) => void;
};

export function MapPanel({ sites, selectedSiteId, onSelectSite }: MapPanelProps) {
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
        const radius = selected ? 8 : site.campusMarker === "curated" ? 6 : site.campusMarker === "main" ? 4.5 : 3;
        const marker = L.circleMarker([site.latitude, site.longitude], {
          radius,
          weight: selected ? 2 : 1,
          color: selected ? "#111111" : STATUS_COLORS[site.statusCode],
          fillColor: STATUS_COLORS[site.statusCode],
          fillOpacity: selected ? 0.9 : 0.7,
          opacity: 1
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
    return () => {
      cancelled = true;
    };
  }, [coordinateSites, onSelectSite, selectedSiteId]);

  return (
    <section className="atlas-panel relative flex min-h-[520px] flex-col overflow-hidden">
      <div className="flex items-start justify-between border-b border-atlas-ink bg-atlas-paper p-3">
        <div>
          <div className="atlas-label text-atlas-muted">National retreat map</div>
          <h2 className="text-xl font-black uppercase leading-tight">Spatialized Campus Closure Record</h2>
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
      <div className="pointer-events-none absolute bottom-3 left-3 border border-atlas-ink bg-atlas-paper/95 p-2 font-mono text-[10px] uppercase">
        <div className="mb-1 font-black">Marker class</div>
        <div>Main / branch / PEPS / curated cases</div>
        <div>Color = computed status code</div>
      </div>
    </section>
  );
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
