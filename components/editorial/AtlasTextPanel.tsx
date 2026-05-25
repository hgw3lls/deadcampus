import type { AtlasTextBlock } from "@/src/data/atlasTexts";

type AtlasTextPanelProps = {
  text: AtlasTextBlock;
  label?: string;
  compact?: boolean;
  accession?: string;
};

export function AtlasTextPanel({ text, label = "Atlas text insertion", compact = false, accession }: AtlasTextPanelProps) {
  return (
    <article className={`atlas-text-panel ${compact ? "atlas-text-panel--compact" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-atlas-ink px-3 py-2">
        <div className="atlas-label text-atlas-muted">{label}</div>
        <div className="font-mono text-[10px] uppercase text-atlas-muted">{accession ?? text.category.replace(/_/g, " ")}</div>
      </div>
      <div className="p-3">
        <h3 className="text-xl font-black uppercase leading-none md:text-2xl">{text.title}</h3>
        <p className="mt-3 whitespace-pre-line font-mono text-[12px] leading-5 md:text-[13px]">{text.body}</p>
        {text.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-1">
            {text.tags.map((tag) => (
              <span key={tag} className="border border-atlas-ink px-2 py-1 font-mono text-[10px] uppercase text-atlas-rule">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
