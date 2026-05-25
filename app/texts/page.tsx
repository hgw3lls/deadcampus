import { AtlasTextPanel } from "@/components/editorial/AtlasTextPanel";
import { StatusCodeGlossary } from "@/components/editorial/StatusCodeGlossary";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SiteShell } from "@/components/layout/SiteShell";
import { atlasTexts, type AtlasTextCategory } from "@/src/data/atlasTexts";

const categoryLabels: Record<AtlasTextCategory, string> = {
  intro_manifesto: "Manifestos",
  closure_fragments: "Closure Notices",
  status_code_texts: "Status Code Glossary",
  fieldwork_notes: "Field Notes",
  replacement_economy: "Replacement Economy",
  map_interstitials: "Essay Fragments",
  micro_captions: "Micro Captions"
};

export default function TextsRoute() {
  const categories = Array.from(new Set(atlasTexts.map((text) => text.category)));

  return (
    <SiteShell>
      <div id="texts" className="atlas-route-grid">
        <SectionHeader
          accession="05 / Texts"
          title="Interventions and fragments"
          description="Poetic-philosophical-political writing layer for manifesto panels, closure notices, status-code texts, field notes, replacement-economy theory, and micro-captions."
          meta="Texts are editable structured records in src/data/atlasTexts.ts."
        />

        <StatusCodeGlossary />

        {categories.map((category) => (
          <section key={category} className="atlas-route-grid">
            <div className="atlas-panel-system p-3">
              <div className="atlas-kicker">Text category</div>
              <h2 className="mt-1 text-2xl font-black uppercase leading-none">{categoryLabels[category]}</h2>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {atlasTexts
                .filter((text) => text.category === category)
                .map((text) => (
                  <AtlasTextPanel key={text.id} text={text} accession={text.id} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </SiteShell>
  );
}
