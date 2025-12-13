import { Session } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabaseClient';

export const getSession = async (): Promise<Session | null> => {
  const client = getSupabaseClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getSession();

  if (error) {
    console.warn('Failed to read Supabase session', error.message);
    return null;
  }

  return data.session ?? null;
};

export const onAuthStateChange = (
  callback: (session: Session | null) => void
): (() => void) => {
  const client = getSupabaseClient();

  if (!client) {
    return () => {};
  }

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session ?? null);
  });

  return () => {
    data?.subscription?.unsubscribe();
  };
};

export const signOut = async (): Promise<void> => {
  const client = getSupabaseClient();

  if (!client) {
    console.warn('Supabase client is not initialized. Skipping sign out.');
    return;
  }

  await client.auth.signOut();
};
