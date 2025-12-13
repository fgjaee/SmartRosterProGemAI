const getEnvVar = (key: keyof ImportMetaEnv): string | undefined => import.meta.env[key];

const getRequiredEnvVar = (key: keyof ImportMetaEnv, label: string): string => {
  const value = getEnvVar(key);
  if (!value) {
    throw new Error(`${label} is not configured. Please set ${key} in your environment.`);
  }
  return value;
};

export const getGeminiApiKey = (): string | null => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    console.warn('Gemini API key not set. AI features are disabled.');
    return null;
  }
  return key;
};

export const getSupabaseConfig = () => ({
  supabaseUrl: getEnvVar('VITE_SUPABASE_URL') || '',
  supabaseAnonKey: getEnvVar('VITE_SUPABASE_ANON_KEY') || '',
});

export const hasSupabaseConfig = (): boolean => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return Boolean(supabaseUrl && supabaseAnonKey);
};
