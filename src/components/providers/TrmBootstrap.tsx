"use client";

import { useEffect } from "react";
import { fetchTrm } from "@/lib/trm";
import { useSessionStore } from "@/store/sessionStore";

export function TrmBootstrap({ children }: { children: React.ReactNode }) {
  const setTrm = useSessionStore((s) => s.setTrm);

  useEffect(() => {
    let cancelled = false;
    fetchTrm().then((result) => {
      if (!cancelled) {
        setTrm(result.value, result.source, result.date);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setTrm]);

  return <>{children}</>;
}
