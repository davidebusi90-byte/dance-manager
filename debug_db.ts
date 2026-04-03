import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODI4NTEsImV4cCI6MjA4NjQ1ODg1MX0.QT6exncW3QI2SjJFOZJKyP8kRj87lLYBrNydqXSNRBc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log("Fetching Jacopo Bombardi from athletes (all, including deleted if accessible)...");
  
  // Note: if RLS hides deleted profiles, we might need a workaround or check how the app queries it
  const { data: athletes, error: athErr } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, duplicate_of, deleted_at')
    .or('first_name.ilike.%jacopo%,last_name.ilike.%bombardi%');
  
  if (athErr) console.error("Athletes error:", athErr);
  else console.log("Athletes found:", athletes);

  console.log("\nFetching couples where athlete 1 or 2 is Daria or Jacopo...");
  
  const { data: couples, error: cplErr } = await supabase
    .from('couples')
    .select('id, athlete1_id, athlete2_id, number, deleted_at, athlete1:athlete1_id(first_name, last_name, deleted_at), athlete2:athlete2_id(first_name, last_name, deleted_at)')
    .or('athlete1_id.in.(select id from athletes where first_name ilike \'%daria%\' or first_name ilike \'%jacopo%\'),athlete2_id.in.(select id from athletes where first_name ilike \'%daria%\' or first_name ilike \'%jacopo%\')');
    
  if (cplErr) console.error("Couples error:", cplErr);
  else {
      // Filter out those that don't actually match Jacopo/Daria (the subquery in `.or` is not valid syntax for nested filtering in supabase-js unfortunately, let's fetch Daria & Jacopo IDs first)
  }
}

async function betterRun() {
  const { data: ids, error: idErr } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, deleted_at')
    .or('first_name.ilike.*Jacopo*,first_name.ilike.*Daria*,last_name.ilike.*Bombardi*');

  if (idErr) {
    console.error("ID Error:", idErr);
    return;
  }
  
  console.log("Found Athletes (Jacopo / Daria):", ids);

  const idList = ids.map(i => i.id).join(',');
  if (!idList) {
    console.log("No athletes found.");
    return;
  }

  const { data: couples, error: cplErr } = await supabase
    .from('couples')
    .select('id, athlete1_id, athlete2_id, number, deleted_at')
    .or(`athlete1_id.in.(${idList}),athlete2_id.in.(${idList})`);

  if (cplErr) {
    console.error("Couples error:", cplErr);
  } else {
    console.log("\nCouples linked to these IDs:", couples);
  }
}

betterRun();
