export type ReplacementCategory = {
  id: string;
  label: string;
  color: string;
  description: string;
};

export const replacementCategories: ReplacementCategory[] = [
  {
    id: "cloud",
    label: "Campus -> Cloud",
    color: "#4fb2c4",
    description: "Classrooms, labs, and annexes retooled as computational infrastructure."
  },
  {
    id: "security",
    label: "Campus -> Security",
    color: "#9d2b2b",
    description: "Educational territory converted into policing, defense, training, detention, or emergency control space."
  },
  {
    id: "housing",
    label: "Campus -> Housing",
    color: "#77667d",
    description: "Dormitories and academic land converted into senior, luxury, student-adjacent, or managed housing."
  },
  {
    id: "healthcare",
    label: "Campus -> Healthcare",
    color: "#607283",
    description: "Campus fabric absorbed by hospitals, clinics, medical offices, recovery systems, or care facilities."
  },
  {
    id: "logistics",
    label: "Campus -> Logistics",
    color: "#3c3c3c",
    description: "Educational buildings and parking fields reclassified as storage, warehousing, staging, or distribution space."
  },
  {
    id: "counter-use",
    label: "Campus -> Civic / Counter-use",
    color: "#3f7f4a",
    description: "Civic reuse, public education, community occupation, or other non-extractive afterlife."
  },
  {
    id: "ruin",
    label: "Campus -> Ruin",
    color: "#111111",
    description: "No stable replacement order yet; the site remains as vacancy, liability, and architectural residue."
  }
];
