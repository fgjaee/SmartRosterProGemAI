const getEnvVar = (key: keyof ImportMetaEnv): string | undefined => import.meta.env[key];

const getRequiredEnvVar = (key: keyof ImportMetaEnv, label: string): string => {
  const value = getEnvVar(key);
  if (!value) {
    throw new Error(`${label} is not configured. Please set ${key} in your environment.`);
  }
  return value;
};

export const getGeminiApiKey = (): string => getRequiredEnvVar('VITE_GEMINI_API_KEY', 'Gemini API key');

export const getSupabaseConfig = () => ({
  supabaseUrl: getEnvVar('VITE_SUPABASE_URL') || '',
  supabaseAnonKey: getEnvVar('VITE_SUPABASE_ANON_KEY') || '',
});

export const hasSupabaseConfig = (): boolean => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return Boolean(supabaseUrl && supabaseAnonKey);
};
