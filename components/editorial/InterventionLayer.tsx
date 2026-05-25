import type { AtlasTextBlock } from "@/src/data/atlasTexts";
import { AtlasTextPanel } from "@/components/editorial/AtlasTextPanel";

type InterventionLayerProps = {
  id?: string;
  title: string;
  label: string;
  texts: AtlasTextBlock[];
  aside?: string;
};

export function InterventionLayer({ id, title, label, texts, aside }: InterventionLayerProps) {
  return (
    <section id={id} className="intervention-layer atlas-panel">
      <div className="grid border-b border-atlas-ink lg:grid-cols-[270px_1fr]">
        <div className="border-b border-atlas-ink bg-atlas-ink p-3 text-atlas-paper lg:border-b-0 lg:border-r">
          <div className="atlas-label opacity-70">{label}</div>
          <h2 className="mt-2 text-2xl font-black uppercase leading-none">{title}</h2>
        </div>
        <div className="p-3 font-mono text-[11px] uppercase leading-4 text-atlas-muted">
          {aside ?? "Interpretive interruption inserted into the data surface. The table continues. The language changes jurisdiction."}
        </div>
      </div>
      <div className={`grid gap-0 ${texts.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {texts.map((text, index) => (
          <div key={text.id} className={index > 0 ? "border-t border-atlas-ink lg:border-l lg:border-t-0" : ""}>
            <AtlasTextPanel text={text} compact label={`Intervention ${String(index + 1).padStart(2, "0")}`} accession={text.id} />
          </div>
        ))}
      </div>
    </section>
  );
}
