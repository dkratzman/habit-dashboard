// supabaseClient.js

const SUPABASE_URL = "https://jqbtpdtvsgmpedddnerp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxYnRwZHR2c2dtcGVkZGRuZXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTMwNTAsImV4cCI6MjA4MDg2OTA1MH0.z9qLJ2zJZSwq3NPC98fEQDm3vPY8YKgG6Z43cfn28vs";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("✅ Supabase client initialized");

