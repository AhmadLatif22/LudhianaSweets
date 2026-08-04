/* ==========================================================================
   supabase-client.js
   TODO(you): create a free project at https://supabase.com, then paste your
   Project URL and anon/public key below (Project Settings → API). The anon
   key is safe to expose in client-side code — it's designed for this — as
   long as Row Level Security policies (see sql/schema.sql) are in place.

   Until you fill these in, the site falls back to the built-in demo
   product data in js/products-data.js so nothing breaks.
   ========================================================================== */

const SUPABASE_URL = "https://wnhjfjpmnhnfrtjqbkcv.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduaGpmanBtbmhuZnJ0anFia2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTI5MDUsImV4cCI6MjEwMTMyODkwNX0.jQyFZZ_2cAdUD3PA-Esz432nhWvRXtMwdryx8eggoJ8"; 

let supabaseClient = null;

if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function isDatabaseConnected() {
  return Boolean(supabaseClient);
}
