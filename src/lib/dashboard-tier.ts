"use client";

import { useEffect, useState } from "react";

export type DashboardTier = "operativo" | "directivo";

const KEY = "pai-dashboard-tier";
const EVENT = "pai-dashboard-tier";

export function readDashboardTier(): DashboardTier {
  try {
    const value = sessionStorage.getItem(KEY);
    if (value === "directivo" || value === "operativo") return value;
  } catch {
    /* sessionStorage can be blocked */
  }
  return "operativo";
}

export function writeDashboardTier(tier: DashboardTier): void {
  try {
    sessionStorage.setItem(KEY, tier);
  } catch {
    /* keep the in-memory value for this view */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useDashboardTier(): { tier: DashboardTier; ready: boolean } {
  const [tier, setTier] = useState<DashboardTier>("operativo");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      setTier(readDashboardTier());
      setReady(true);
    }
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  return { tier, ready };
}
