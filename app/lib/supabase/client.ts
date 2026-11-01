import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
}

/** Klien Supabase untuk browser (anon key + sesi login staf). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321',
      import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-anon-key',
    );
  }
  return client;
}
