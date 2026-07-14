import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg4Mjg1MSwiZXhwIjoyMDg2NDU4ODUxfQ.sXBf6lqb2b5ugwR7xdqycAR-S4uGF2JDSVhCDNcJY28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
