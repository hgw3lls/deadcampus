import { AtlasPanel } from "@/components/layout/AtlasPanel";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SiteShell } from "@/components/layout/SiteShell";
import { sourceRegistry } from "@/src/data/sources";

const routeMap = [
  ["/", "Overview", "project thesis, key stats, map preview, routing index"],
  ["/explorer", "Atlas Explorer", "map, timeline, matrix, ownership, evidence wall, table/search surfaces"],
  ["/dossiers", "Dossiers", "campus-level records and poetic dossier captions"],
  ["/fieldwork", "Fieldwork", "methodology, evidence checklist, research queue"],
  ["/replacement-economy", "Replacement Economy", "interpretive afterlife categories and matrix"],
  ["/texts", "Texts / Interventions", "manifestos, notes, micro-captions, status glossary"],
  ["/about", "About / Sources", "data method, source registry, limitations, deployment notes"]
];

export default function AboutRoute() {
  return (
    <SiteShell>
      <div id="about" className="atlas-route-grid">
        <SectionHeader
          accession="06 / About"
          title="Sources, method, limitations"
          description="Dead Campus Atlas is a research interface for workbook-derived data. The current site separates generated data, normalized data contracts, route components, and poetic interventions."
          meta="Static export target: hgw3lls.github.io/deadcampus via GitHub Actions."
        />

        <div className="grid gap-3 xl:grid-cols-2">
          <AtlasPanel className="p-3">
            <div className="atlas-kicker">Data methodology</div>
            <p className="atlas-copy mt-3">
              The workbook is parsed by scripts/preprocessWorkbook.ts into JSON files under public/data. These generated files are raw public build output and
              should be regenerated from the workbook, not hand-edited. src/lib/loadCampusData.ts adapts generated records into a stable normalized campus-site
              shape for route components.
            </p>
          </AtlasPanel>
          <AtlasPanel className="p-3">
            <div className="atlas-kicker">Limitations</div>
            <p className="atlas-copy mt-3">
              Many records remain missing coordinates, afterlife status, buyer/controller fields, source URLs, morphology, or verification. The research queue
              is not a failure state; it is the atlas work surface.
            </p>
          </AtlasPanel>
        </div>

        <AtlasPanel>
          <div className="border-b border-atlas-ink p-3">
            <div className="atlas-kicker">Route / section map</div>
          </div>
          <div className="atlas-table-scroll">
            <table className="w-full min-w-[720px] border-collapse font-mono text-[11px] uppercase">
              <tbody>
                {routeMap.map(([href, label, description]) => (
                  <tr key={href} className="border-b border-atlas-ink">
                    <td className="border-r border-atlas-ink p-2 font-black">{href}</td>
                    <td className="border-r border-atlas-ink p-2">{label}</td>
                    <td className="p-2 text-atlas-muted">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AtlasPanel>

        <AtlasPanel>
          <div className="border-b border-atlas-ink p-3">
            <div className="atlas-kicker">Source registry</div>
          </div>
          <div className="grid md:grid-cols-2">
            {sourceRegistry.map((source) => (
              <div key={source.id} className="border-b border-r border-atlas-ink p-3">
                <div className="font-mono text-xs font-black uppercase">{source.label}</div>
                {source.path ? <div className="mt-1 break-all font-mono text-[10px] uppercase text-atlas-muted">{source.path}</div> : null}
                <p className="atlas-copy mt-2 text-atlas-muted">{source.description}</p>
              </div>
            ))}
          </div>
        </AtlasPanel>

        <AtlasPanel className="p-3">
          <div className="atlas-kicker">Version history</div>
          <p className="atlas-copy mt-3">
            Current architecture pass: top-level routes, shared atlas shell/nav, centralized src/data modules, normalized loader, explorer scaffold, dossier system,
            fieldwork route, replacement economy route, texts route, and GitHub Pages-safe static export.
          </p>
        </AtlasPanel>
      </div>
    </SiteShell>
  );
}
