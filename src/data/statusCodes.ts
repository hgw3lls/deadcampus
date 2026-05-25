import type { StatusCode } from "@/lib/data";

export type AtlasStatusCodeDefinition = {
  code: StatusCode;
  label: string;
  color: string;
  description: string;
};

export const atlasStatusCodes: AtlasStatusCodeDefinition[] = [
  {
    code: "ACTIVE-RISK",
    label: "ACTIVE-RISK",
    color: "#b9851f",
    description: "Operational institution whose long-term assumptions already show structural failure."
  },
  {
    code: "CLOSURE-EVENT",
    label: "CLOSURE-EVENT",
    color: "#111111",
    description: "Closure, teach-out, merger, revocation, or terminal institutional event."
  },
  {
    code: "ASSET-TRANSFER",
    label: "ASSET-TRANSFER",
    color: "#607283",
    description: "Campus, parcel, or institutional asset moved into another controlling regime."
  },
  {
    code: "PARCELIZED",
    label: "PARCELIZED",
    color: "#77667d",
    description: "Educational land split into legal fragments, leases, auctions, or separate ownership paths."
  },
  {
    code: "CLOUD",
    label: "CLOUD",
    color: "#4fb2c4",
    description: "Educational infrastructure converted toward data, computation, redundancy, or server logistics."
  },
  {
    code: "SECURITY",
    label: "SECURITY",
    color: "#9d2b2b",
    description: "Campus territory reused for policing, defense, detention, emergency, or perimeter functions."
  },
  {
    code: "RUIN",
    label: "RUIN",
    color: "#3c3c3c",
    description: "Vacancy, abandonment, deterioration, or unresolved dead asset condition."
  },
  {
    code: "COUNTER-USE",
    label: "COUNTER-USE",
    color: "#3f7f4a",
    description: "Civic, mutual, educational, or public reuse that resists pure extraction logic."
  }
];
