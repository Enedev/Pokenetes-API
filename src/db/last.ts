import { SupabaseClient } from '@supabase/supabase-js';

export async function fetchLastLocalRecord(
  supabase: SupabaseClient,
  table: string,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return { data: null, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { data: (row as Record<string, unknown> | null) ?? null, error: null };
}
