import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig, hasSupabaseConfig } from "./env";

let cachedClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (cachedClient) return cachedClient;

  if (!hasSupabaseConfig()) {
    console.warn('Supabase environment variables are not set. Database features are disabled.');
    return null;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
};
