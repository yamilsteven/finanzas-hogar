"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** Avoid SSR/client mismatch with Zustand persist */
export function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
