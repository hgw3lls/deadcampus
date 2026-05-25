"use client";

import { useEffect, useState } from "react";
import type { NormalizedCampusSite } from "@/src/data/campusSites";
import { loadCampusData } from "@/src/lib/loadCampusData";
import type { AtlasData } from "@/lib/data";

export type CampusDataState = {
  atlas: AtlasData | null;
  campusSites: NormalizedCampusSite[];
  error: string | null;
  loading: boolean;
};

export function useCampusData(): CampusDataState {
  const [state, setState] = useState<CampusDataState>({
    atlas: null,
    campusSites: [],
    error: null,
    loading: true
  });

  useEffect(() => {
    let cancelled = false;
    loadCampusData()
      .then((data) => {
        if (!cancelled) {
          setState({ atlas: data.atlas, campusSites: data.campusSites, error: null, loading: false });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ atlas: null, campusSites: [], error: error.message, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
