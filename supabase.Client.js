// supabaseClient.js
const SUPABASE_URL = "https://jqbtpdtvsgmpedddnerp.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,     // ✅ keep logged in
      autoRefreshToken: true,   // ✅ refresh silently
      detectSessionInUrl: true
    }
  }
);
