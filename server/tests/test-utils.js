export function isRealSupabaseConfigured() {
  const url = String(process.env.SUPABASE_URL ?? "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const jwtSecret = String(process.env.JWT_SECRET ?? "");

  const urlLooksPlaceholder = !url || url.includes("your-project.supabase.co") || url.toLowerCase().includes("your-project");
  const keyLooksPlaceholder = !key || key.includes("your_service_role_key") || key.toLowerCase().includes("your_") || key.toLowerCase().includes("changeme");
  const jwtLooksPlaceholder = !jwtSecret || jwtSecret.includes("change_me_in_production") || jwtSecret.toLowerCase().includes("change_me");

  // We require URL + service role key at minimum, plus a non-placeholder JWT secret.
  return Boolean(url && key && !urlLooksPlaceholder && !keyLooksPlaceholder && !jwtLooksPlaceholder);
}

