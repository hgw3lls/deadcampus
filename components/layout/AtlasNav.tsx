"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type NavItem = { href: string; label: string; accession: string; external?: boolean };

const navItems: NavItem[] = [
  { href: "/", label: "Overview", accession: "00" },
  { href: "/explorer", label: "Atlas Explorer", accession: "01" },
  { href: "/dossiers", label: "Dossiers", accession: "02" },
  { href: "/fieldwork", label: "Fieldwork", accession: "03" },
  { href: "/replacement-economy", label: "Replacement Economy", accession: "04" },
  { href: "/texts", label: "Texts / Interventions", accession: "05" },
  { href: "/about", label: "About / Sources", accession: "06" },
  // The static atlas is a separate site published at /atlas/, so it is a plain link,
  // not a client-side route.
  { href: "/atlas/", label: "Static Atlas / Data", accession: "07", external: true }
];

export function AtlasNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dead Campus Atlas section index" className="site-shell__nav">
      <div className="site-shell__nav-grid">
        {navItems.map((item) => {
          if (item.external) {
            return (
              <a key={item.href} href={`${basePath}${item.href}`} className="atlas-nav-link">
                <span className="mr-2 text-atlas-muted">{item.accession}</span>
                {item.label}
              </a>
            );
          }
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className="atlas-nav-link" aria-current={active ? "page" : undefined}>
              <span className="mr-2 text-atlas-muted">{item.accession}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
