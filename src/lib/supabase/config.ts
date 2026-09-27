/** Normaliza Project URL: sin /rest/v1 ni slash final */
export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/rest\/v1$/i, "");
}

export function getSupabaseConfig() {
  const url = normalizeSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  );
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const configured = Boolean(url && anonKey && !url.includes("TU-PROYECTO"));
  return { url, anonKey, configured };
}
