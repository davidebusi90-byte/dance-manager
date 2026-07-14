import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg4Mjg1MSwiZXhwIjoyMDg2NDU4ODUxfQ.sXBf6lqb2b5ugwR7xdqycAR-S4uGF2JDSVhCDNcJY28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkBevilacquaMandorini() {
  console.log("=== 1. FETCHING CATERINA ALBERGHINI PROFILE ===");
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', '%caterina%alberghini%')
    .maybeSingle();
  console.log("Caterina's profile:", profile);

  console.log("\n=== 2. FETCHING ATHLETES BEVILACQUA AND MANDORINI ===");
  const { data: athletes, error: athErr } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, instructor_id, responsabili, is_deleted')
    .or('last_name.ilike.%bevilacqua%,last_name.ilike.%mandorini%');

  if (athErr) {
    console.error("Error fetching athletes:", athErr);
    return;
  }
  console.log("Athletes found:", athletes);

  const athleteIds = athletes.map(a => a.id);

  console.log("\n=== 3. FETCHING ATHLETE-INSTRUCTOR LINKS ===");
  const { data: links } = await supabase
    .from('athlete_instructors')
    .select('*')
    .in('athlete_id', athleteIds);

  console.log("Links found:", links);
  if (profile) {
    const caterinaLinks = links.filter(l => l.profile_id === profile.id);
    console.log("Caterina's links to these athletes:");
    caterinaLinks.forEach(cl => {
      const ath = athletes.find(a => a.id === cl.athlete_id);
      console.log(`- Linked to: ${ath?.first_name} ${ath?.last_name} (is_deleted: ${ath?.is_deleted})`);
    });
  }

  console.log("\n=== 4. FETCHING COUPLES FOR THESE ATHLETES ===");
  const { data: couples } = await supabase
    .from('couples')
    .select('id, athlete1_id, athlete2_id, instructor_id, responsabili, is_active')
    .or(`athlete1_id.in.(${athleteIds.join(',')}),athlete2_id.in.(${athleteIds.join(',')})`);

  console.log("Couples found:", couples);
  if (couples && couples.length > 0) {
    for (const couple of couples) {
      const a1 = athletes.find(a => a.id === couple.athlete1_id);
      const a2 = athletes.find(a => a.id === couple.athlete2_id);
      console.log(`- Couple: ${a1 ? a1.first_name + ' ' + a1.last_name : 'Unknown'} & ${a2 ? a2.first_name + ' ' + a2.last_name : 'Unknown'}`);
      console.log(`  * ID: ${couple.id}`);
      console.log(`  * Is Active: ${couple.is_active}`);
      console.log(`  * responsabili:`, couple.responsabili);
    }
  }
}

checkBevilacquaMandorini();
