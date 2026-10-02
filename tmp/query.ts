import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://kymoxuucjfgotjlhkfua.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODI4NTEsImV4cCI6MjA4NjQ1ODg1MX0.QT6exncW3QI2SjJFOZJKyP8kRj87lLYBrNydqXSNRBc";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data: athletes, error } = await supabase
        .from('athletes')
        .select('*')
        .ilike('last_name', '%affronti%');
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    console.log("Athletes found:", athletes);

    const { data: couples, error: cError } = await supabase
        .from('couples')
        .select('*, athlete1:athlete1_id(*), athlete2:athlete2_id(*)')
        .or(`athlete1_id.in.(${athletes.map(a => a.id).join(',')}),athlete2_id.in.(${athletes.map(a => a.id).join(',')})`);

    console.log("Couples found:", JSON.stringify(couples, null, 2));
}

check();
