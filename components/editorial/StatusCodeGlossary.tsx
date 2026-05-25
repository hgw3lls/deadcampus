import { statusCodeTextByCode } from "@/src/data/atlasTexts";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/data";

export function StatusCodeGlossary() {
  return (
    <section id="status-codes" className="atlas-panel">
      <div className="grid border-b border-atlas-ink lg:grid-cols-[1fr_310px]">
        <div className="p-3">
          <div className="atlas-label text-atlas-muted">Classification glossary / poetic status code layer</div>
          <h2 className="mt-1 text-2xl font-black uppercase leading-none md:text-3xl">Status Codes as Administrative Weather</h2>
        </div>
        <div className="border-t border-atlas-ink p-3 font-mono text-[11px] uppercase leading-4 text-atlas-muted lg:border-l lg:border-t-0">
          Color remains operational. Meaning has been expanded from dashboard category into field interpretation.
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4">
        {STATUS_LABELS.map((status) => {
          const text = statusCodeTextByCode[status.key];
          return (
            <article key={status.key} className="min-h-[218px] border-b border-r border-atlas-ink p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 border border-atlas-ink" style={{ background: STATUS_COLORS[status.key] }} />
                  <h3 className="font-mono text-xs font-black uppercase">{status.label}</h3>
                </div>
                <span className="border border-atlas-ink px-1.5 py-0.5 font-mono text-[9px] uppercase text-atlas-muted">coded</span>
              </div>
              <p className="whitespace-pre-line font-mono text-[11px] uppercase leading-4">{text?.body ?? "No glossary text has been filed for this code."}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
