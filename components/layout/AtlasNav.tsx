"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview", accession: "00" },
  { href: "/explorer", label: "Atlas Explorer", accession: "01" },
  { href: "/dossiers", label: "Dossiers", accession: "02" },
  { href: "/fieldwork", label: "Fieldwork", accession: "03" },
  { href: "/replacement-economy", label: "Replacement Economy", accession: "04" },
  { href: "/texts", label: "Texts / Interventions", accession: "05" },
  { href: "/about", label: "About / Sources", accession: "06" }
];

export function AtlasNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dead Campus Atlas section index" className="border-t border-atlas-ink lg:border-l lg:border-t-0">
      <div className="grid lg:min-w-[254px]">
        {navItems.map((item) => {
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
