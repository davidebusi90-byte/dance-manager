import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODI4NTEsImV4cCI6MjA4NjQ1ODg1MX0.QT6exncW3QI2SjJFOZJKyP8kRj87lLYBrNydqXSNRBc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('competitions')
    .select('*');
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Competitions:", data);
  }
}

run();
