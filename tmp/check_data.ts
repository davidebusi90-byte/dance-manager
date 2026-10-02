import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: athletes } = await supabase.from('athletes').select('*').ilike('last_name', '%Accorsi%');
  console.log("Athletes:", JSON.stringify(athletes, null, 2));

  if (athletes && athletes.length > 0) {
    const athlete = athletes[0];
    const { data: couples } = await supabase.from('couples')
      .select('*')
      .or(`athlete1_id.eq.${athlete.id},athlete2_id.eq.${athlete.id}`);
    
    console.log("Couples:", JSON.stringify(couples, null, 2));
    
    for (const c of (couples || [])) {
        const partnerId = c.athlete1_id === athlete.id ? c.athlete2_id : c.athlete1_id;
        if (partnerId) {
            const { data: partner } = await supabase.from('athletes').select('*').eq('id', partnerId);
            console.log("Partner:", JSON.stringify(partner, null, 2));
        }
    }
  }
}
check();
