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
      <header className="site-shell__header">
        <div className="site-shell__brand">
          <div className="atlas-kicker">Dead Campus Atlas / Terminal Education</div>
          <div className="site-shell__title">Dead Campus Atlas</div>
          <p className="site-shell__dek">
            Forensic atlas of educational withdrawal / closure, transfer, parcelization, cloud/security conversion, and land afterlives.
          </p>
        </div>
        <AtlasNav />
      </header>
      <main className="site-shell__main">{children}</main>
      <footer className="site-shell__footer">
        <FragmentTicker captions={microCaptions} />
        <div className="site-shell__footer-stamp">
          Public archive interface / generated workbook data / GitHub Pages static export.
        </div>
      </footer>
    </div>
  );
}
