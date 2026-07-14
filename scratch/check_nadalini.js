import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kymoxuucjfgotjlhkfua.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg4Mjg1MSwiZXhwIjoyMDg2NDU4ODUxfQ.sXBf6lqb2b5ugwR7xdqycAR-S4uGF2JDSVhCDNcJY28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkNadaliniVenturini() {
  console.log("=== 1. FETCHING CATERINA ALBERGHINI PROFILE ===");
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, user_id')
    .ilike('full_name', '%caterina%alberghini%')
    .maybeSingle();

  if (profErr) {
    console.error("Error fetching profile:", profErr);
    return;
  }
  console.log("Caterina's profile:", profile);

  if (!profile) {
    console.log("Caterina Alberghini profile not found!");
    return;
  }

  console.log("\n=== 2. FETCHING ATHLETES NADALINI AND VENTURINI ===");
  const { data: athletes, error: athErr } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, instructor_id, responsabili, is_deleted')
    .or('last_name.ilike.%nadalini%,last_name.ilike.%venturini%');

  if (athErr) {
    console.error("Error fetching athletes:", athErr);
    return;
  }
  console.log("Athletes found:", athletes);

  if (athletes.length === 0) {
    console.log("No athletes found matching Nadalini or Venturini.");
    return;
  }

  const athleteIds = athletes.map(a => a.id);

  console.log("\n=== 3. FETCHING ATHLETE-INSTRUCTOR LINKS ===");
  const { data: links, error: linkErr } = await supabase
    .from('athlete_instructors')
    .select('*')
    .in('athlete_id', athleteIds);

  if (linkErr) {
    console.error("Error fetching athlete_instructors links:", linkErr);
  } else {
    console.log("Athlete-Instructor links:", links);
    const caterinaLinks = links.filter(l => l.profile_id === profile.id);
    console.log(`Caterina has links to ${caterinaLinks.length} of these athletes.`);
    caterinaLinks.forEach(cl => {
      const ath = athletes.find(a => a.id === cl.athlete_id);
      console.log(`- Linked to: ${ath?.first_name} ${ath?.last_name} (ID: ${ath?.id})`);
    });
  }

  console.log("\n=== 4. FETCHING COUPLES FOR THESE ATHLETES ===");
  const { data: couples, error: cplErr } = await supabase
    .from('couples')
    .select('id, athlete1_id, athlete2_id, instructor_id, responsabili, is_active')
    .or(`athlete1_id.in.(${athleteIds.join(',')}),athlete2_id.in.(${athleteIds.join(',')})`);

  if (cplErr) {
    console.error("Error fetching couples:", cplErr);
    return;
  }
  console.log("Couples found:", couples);

  for (const couple of couples) {
    const a1 = athletes.find(a => a.id === couple.athlete1_id);
    const a2 = athletes.find(a => a.id === couple.athlete2_id);
    console.log(`\nAnalyzing couple: ${a1 ? a1.first_name + ' ' + a1.last_name : 'Unknown'} - ${a2 ? a2.first_name + ' ' + a2.last_name : 'Unknown'}`);
    console.log(`- ID: ${couple.id}`);
    console.log(`- Is Active: ${couple.is_active}`);
    console.log(`- instructor_id column: ${couple.instructor_id}`);
    console.log(`- responsabili array:`, couple.responsabili);

    const hasDirectMatch = couple.instructor_id === profile.id;
    console.log(`- Rule 1 (direct instructor_id match): ${hasDirectMatch}`);

    const isAthlete1Linked = links.some(l => l.athlete_id === couple.athlete1_id && l.profile_id === profile.id);
    console.log(`- Rule 2a (Athlete 1 linked to Caterina): ${isAthlete1Linked}`);

    const isAthlete2Linked = links.some(l => l.athlete_id === couple.athlete2_id && l.profile_id === profile.id);
    console.log(`- Rule 2b (Athlete 2 linked to Caterina): ${isAthlete2Linked}`);

    const hasNameInResponsabili = (couple.responsabili || []).some((resp) => {
      return resp.toLowerCase().includes('caterina') && resp.toLowerCase().includes('alberghini');
    });
    console.log(`- Rule 3 (Caterina in couple's responsabili): ${hasNameInResponsabili}`);

    const canSee = hasDirectMatch || isAthlete1Linked || isAthlete2Linked || hasNameInResponsabili;
    console.log(`=> WOULD CATERINA BE ABLE TO SEE THIS COUPLE UNDER THE NEW RULE? ${canSee ? 'YES' : 'NO'}`);
  }
}

checkNadaliniVenturini();
