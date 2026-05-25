type SectionHeaderProps = {
  accession: string;
  title: string;
  description: string;
  meta?: string;
};

export function SectionHeader({ accession, title, description, meta }: SectionHeaderProps) {
  const assetBase = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets/terminal-education`;

  return (
    <header className="atlas-section-header p-3">
      <img className="atlas-section-header__mark" src={`${assetBase}/te-logo.png`} alt="" aria-hidden="true" />
      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="atlas-kicker">{accession}</div>
          <h1 className="atlas-title-lg mt-2">{title}</h1>
          <p className="atlas-copy mt-3 max-w-5xl text-atlas-rule">{description}</p>
        </div>
        {meta ? <div className="border border-atlas-ink p-3 font-mono text-[11px] uppercase leading-4 text-atlas-muted">{meta}</div> : null}
      </div>
    </header>
  );
}
