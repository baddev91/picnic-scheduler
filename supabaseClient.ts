import { createClient } from '@supabase/supabase-js';

// ISTRUZIONI:
// 1. Vai su Supabase > Project Settings > API
// 2. Copia "Project URL" e incollalo qui sotto in SUPABASE_URL
// 3. Copia "anon" "public" key e incollala qui sotto in SUPABASE_ANON_KEY
// NON committare mai la 'service_role' key qui!

const SUPABASE_URL = 'https://zfefhpozpsolzqqusdkc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZocG96cHNvbHpxcXVzZGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTYzMTQsImV4cCI6MjA4MzAzMjMxNH0.FPXVYG_V31xnxcvAWo5JB9MkVcK0l8gWtbkbA86pe5w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
