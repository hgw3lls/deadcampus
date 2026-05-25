import { AtlasTextPanel } from "@/components/editorial/AtlasTextPanel";
import type { AtlasTextBlock } from "@/src/data/atlasTexts";

type TextInterventionProps = {
  text: AtlasTextBlock;
  accession?: string;
  label?: string;
};

export function TextIntervention({ text, accession, label = "Text intervention" }: TextInterventionProps) {
  return (
    <div className="my-3">
      <AtlasTextPanel text={text} label={label} accession={accession ?? text.id} />
    </div>
  );
}
