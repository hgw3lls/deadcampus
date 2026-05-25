import type { ReactNode } from "react";
import { FragmentTicker } from "@/components/editorial/FragmentTicker";
import { AtlasNav } from "@/components/layout/AtlasNav";
import { microCaptions } from "@/src/data/atlasTexts";

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  const assetBase = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets/terminal-education`;

  return (
    <div className="site-shell">
      <header className="site-shell__header">
        <div className="site-shell__brand">
          <div className="site-shell__brand-copy">
            <div className="atlas-kicker">Dead Campus Atlas / Terminal Education</div>
            <img className="site-shell__wordmark" src={`${assetBase}/te-name.png`} alt="Terminal Education" />
            <p className="site-shell__dek">
              Forensic atlas of educational withdrawal / closure, transfer, parcelization, cloud/security conversion, and land afterlives.
            </p>
          </div>
          <img className="site-shell__brand-art" src={`${assetBase}/te-atlas.png`} alt="" aria-hidden="true" />
        </div>
        <AtlasNav />
      </header>
      <main className="site-shell__main">{children}</main>
      <footer className="site-shell__footer">
        <FragmentTicker captions={microCaptions} />
        <div className="site-shell__footer-stamp">
          <img className="site-shell__footer-seal" src={`${assetBase}/te-seal.png`} alt="" aria-hidden="true" />
          Public archive interface / generated workbook data / GitHub Pages static export.
        </div>
      </footer>
    </div>
  );
}
