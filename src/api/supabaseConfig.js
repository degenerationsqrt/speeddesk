export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export function getSupabaseSetupState() {
  return {
    isConfigured: isSupabaseConfigured,
    missing: [
      !supabaseUrl && "VITE_SUPABASE_URL",
      !supabasePublishableKey && "VITE_SUPABASE_PUBLISHABLE_KEY",
    ].filter(Boolean),
  };
}
