const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const env = dotenv.parse(fs.readFileSync('.env', 'utf8'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('sync_logs').select('raw_payload').not('raw_payload', 'is', null).order('created_at', {ascending: false}).limit(1);
  if (error) {
    console.error(error);
    return;
  }
  if(data && data[0] && data[0].raw_payload && data[0].raw_payload.athletes) {
     console.log(JSON.stringify(data[0].raw_payload.athletes[0], null, 2));
  } else {
     console.log('No data found');
  }
}
run();
