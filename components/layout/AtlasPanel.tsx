import type { ReactNode } from "react";

type AtlasPanelProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export function AtlasPanel({ children, className = "", id }: AtlasPanelProps) {
  return (
    <section id={id} className={`atlas-panel-system ${className}`}>
      {children}
    </section>
  );
}
