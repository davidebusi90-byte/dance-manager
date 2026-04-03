const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODI4NTEsImV4cCI6MjA4NjQ1ODg1MX0.QT6exncW3QI2SjJFOZJKyP8kRj87lLYBrNydqXSNRBc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .ilike('last_name', '%Bombardi%');

  if (error) {
    console.error('Error fetching:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
