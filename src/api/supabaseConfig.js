export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseSetupState() {
  return {
    isConfigured: isSupabaseConfigured,
    missing: [
      !supabaseUrl && "VITE_SUPABASE_URL",
      !supabaseAnonKey && "VITE_SUPABASE_ANON_KEY",
    ].filter(Boolean),
  };
}
