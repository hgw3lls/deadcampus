import { atlasStatusCodes } from "@/src/data/statusCodes";
import { replacementCategories } from "@/src/data/replacementCategories";

type DataLegendProps = {
  mode?: "status" | "replacement" | "both";
};

export function DataLegend({ mode = "both" }: DataLegendProps) {
  return (
    <section className="atlas-panel-system">
      <div className="border-b border-atlas-ink px-3 py-2">
        <div className="atlas-kicker">Data legend / classification marks</div>
      </div>
      {(mode === "status" || mode === "both") && (
        <div className="grid md:grid-cols-2 xl:grid-cols-4">
          {atlasStatusCodes.map((status) => (
            <div key={status.code} className="border-b border-r border-atlas-ink p-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 border border-atlas-ink" style={{ background: status.color }} />
                <span className="font-mono text-[11px] font-black uppercase">{status.label}</span>
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase leading-4 text-atlas-muted">{status.description}</p>
            </div>
          ))}
        </div>
      )}
      {(mode === "replacement" || mode === "both") && (
        <div className="grid md:grid-cols-2 xl:grid-cols-4">
          {replacementCategories.map((category) => (
            <div key={category.id} className="border-b border-r border-atlas-ink p-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 border border-atlas-ink" style={{ background: category.color }} />
                <span className="font-mono text-[11px] font-black uppercase">{category.label}</span>
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase leading-4 text-atlas-muted">{category.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
