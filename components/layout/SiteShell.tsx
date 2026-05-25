import type { ReactNode } from "react";
import { FragmentTicker } from "@/components/editorial/FragmentTicker";
import { AtlasNav } from "@/components/layout/AtlasNav";
import { microCaptions } from "@/src/data/atlasTexts";

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="site-shell">
      <header className="site-shell__header grid lg:grid-cols-[1fr_auto]">
        <div className="p-3">
          <div className="atlas-kicker">Dead Campus Atlas / Terminal Education</div>
          <div className="mt-2 text-3xl font-black uppercase leading-none md:text-5xl">Forensic atlas of educational withdrawal</div>
          <p className="atlas-copy mt-3 max-w-4xl text-atlas-rule">
            Campus closures, asset transfer, parcelization, cloud/security conversion, institutional collapse, and the replacement economy of educational land.
          </p>
        </div>
        <AtlasNav />
      </header>
      <main className="site-shell__main">{children}</main>
      <footer className="site-shell__footer">
        <FragmentTicker captions={microCaptions} />
        <div className="mt-3 border border-atlas-ink p-3 font-mono text-[10px] uppercase text-atlas-muted">
          Public archive interface / generated workbook data / GitHub Pages static export.
        </div>
      </footer>
    </div>
  );
}
