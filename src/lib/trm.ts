import { STATIC_TRM } from "@/lib/currency";

const DATOS_GOV_URL =
  "https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC";
const ER_API_URL = "https://open.er-api.com/v6/latest/USD";

export interface TrmResult {
  value: number;
  source: "datos.gov.co" | "open.er-api" | "static";
  date?: string;
}

export async function fetchTrm(): Promise<TrmResult> {
  try {
    const res = await fetch(DATOS_GOV_URL);
    if (res.ok) {
      const data = (await res.json()) as Array<{
        valor?: string;
        vigenciadesde?: string;
      }>;
      const raw = data?.[0]?.valor?.replace(",", ".");
      const value = raw ? Number.parseFloat(raw) : NaN;
      if (Number.isFinite(value) && value > 0) {
        return {
          value,
          source: "datos.gov.co",
          date: data[0]?.vigenciadesde,
        };
      }
    }
  } catch {
    // fall through
  }

  try {
    const res = await fetch(ER_API_URL);
    if (res.ok) {
      const data = (await res.json()) as {
        rates?: { COP?: number };
        time_last_update_utc?: string;
      };
      const value = data?.rates?.COP;
      if (typeof value === "number" && value > 0) {
        return {
          value,
          source: "open.er-api",
          date: data.time_last_update_utc,
        };
      }
    }
  } catch {
    // fall through
  }

  return { value: STATIC_TRM, source: "static" };
}
