import { getSupabaseAdmin } from "../lib/supabase.js";

export async function listReports({ limit = 50 } = {}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(limit) || 50, 200));
  if (error) throw error;
  return data ?? [];
}

