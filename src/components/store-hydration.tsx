"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/** True once the signed-in user's data has been loaded from Supabase. */
export function useStoreHydrated() {
  return useAppStore((s) => s.loaded);
}

/** Starts the Supabase session listener once for the whole app. */
export function StoreHydration() {
  useEffect(() => {
    void useAppStore.getState().init();
  }, []);
  return null;
}
