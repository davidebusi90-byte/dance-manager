
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data: athletes, error } = await supabase
        .from('athletes')
        .select('*')
        .or('first_name.ilike.%luppi%,last_name.ilike.%luppi%,first_name.ilike.%di nono%,last_name.ilike.%di nono%');

    if (error) {
        console.error(error);
        return;
    }

    console.log("Found athletes:", athletes.length);
    athletes.forEach(a => {
        console.log(`- ${a.code}: ${a.first_name} ${a.last_name} (ID: ${a.id}, Responsabili: ${a.responsabili})`);
    });

    const { data: couples, error: cError } = await supabase
        .from('couples')
        .select('*')
        .or(`athlete1_id.in.(${athletes.map(a => a.id).join(',')}),athlete2_id.in.(${athletes.map(a => a.id).join(',')})`);

    if (cError) {
        console.error(cError);
    } else {
        console.log("Found couples:", couples.length);
        couples.forEach(c => {
            console.log(`- Couple ID: ${c.id}, A1: ${c.athlete1_id}, A2: ${c.athlete2_id}`);
        });
    }
}

checkData();
