import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './env';

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
};

export const signInWithEmail = (email: string) => {
  const client = getSupabaseClient();

  if (!client) {
    console.warn('Supabase client is not initialized. Check your environment configuration.');
    return;
  }

  return client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
};

export const signInWithGoogle = () => {
  const client = getSupabaseClient();

  if (!client) {
    console.warn('Supabase client is not initialized. Check your environment configuration.');
    return;
  }

  return client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
};

export type { Session };
