import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kymoxuucjfgotjlhkfua.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg4Mjg1MSwiZXhwIjoyMDg2NDU4ODUxfQ.sXBf6lqb2b5ugwR7xdqycAR-S4uGF2JDSVhCDNcJY28";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching latest log...");
  const { data: files, error: err1 } = await supabase.storage.from("api-logs").list();
  if (!files || files.length === 0) {
    console.error("No logs found.");
    return;
  }
  
  files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = files[0];
  console.log("Latest log:", latest.name);
  
  const { data: fileData, error: err2 } = await supabase.storage.from("api-logs").download(latest.name);
  if (!fileData) {
    console.error("Error downloading file:", err2);
    return;
  }
  
  const text = await fileData.text();
  const payload = JSON.parse(text);
  
  console.log(`Processing ${payload.athletes.length} athletes...`);
  
  let athleteUpdates = 0;
  for (const athlete of payload.athletes) {
    if (!athlete.code) continue;
    
    const disciplineInfo: Record<string, string> = {};
    for (let i = 1; i <= 6; i++) {
        const disc = (athlete as any)[`disc${i}`];
        const cls = (athlete as any)[`class${i}`];
        if (disc && cls) {
            const discName = disc.toLowerCase();
            let key = discName;
            if (discName.includes("combinata") || discName.includes("10 balli")) key = "combinata";
            else if (discName.includes("latino") || discName.includes("latin") || /\bla\b/.test(discName)) key = "latino";
            else if (discName.includes("standard") || /\bstd\b/.test(discName)) key = "standard";
            else if (discName.includes("show")) key = "show_dance";
            
            disciplineInfo[key] = cls.toUpperCase();
        }
    }
    
    const { error } = await supabase
        .from("athletes")
        .update({ discipline_info: disciplineInfo })
        .eq("code", athlete.code);
        
    if (error) {
        console.error(`Error updating athlete ${athlete.code}:`, error);
    } else {
        athleteUpdates++;
    }
  }
  
  console.log(`Updated ${athleteUpdates} athletes. Processing couples...`);
  
  // Update Couples
  const activeAthletesMap = new Map<string, string>();
  const { data: athletesDb } = await supabase.from("athletes").select("id, code").eq("is_deleted", false);
  athletesDb?.forEach(a => activeAthletesMap.set(a.code, a.id));

  const couplesToUpsert: any[] = [];
  const processedPairs = new Set<string>();

  for (const athlete of payload.athletes) {
      if (athlete.partner_code && athlete.partner_code !== athlete.code) {
          const a1Id = activeAthletesMap.get(athlete.code);
          const a2Id = activeAthletesMap.get(athlete.partner_code);
          if (a1Id && a2Id) {
              const pairKey = [athlete.code, athlete.partner_code].sort().join("-");
              if (!processedPairs.has(pairKey)) {
                  processedPairs.add(pairKey);
                  
                  const discInfo: Record<string, string> = {};
                  const discs = new Set<string>();

                  for (let i = 1; i <= 6; i++) {
                    const d = (athlete as any)[`disc${i}`];
                    const c = (athlete as any)[`class${i}`];
                    if (d && c) {
                      const normD = d.toLowerCase();
                      let k = normD;
                      if (normD.includes("combinata") || normD.includes("10 balli")) k = "combinata";
                      else if (normD.includes("latino") || normD.includes("latin") || /\bla\b/.test(normD)) k = "latino";
                      else if (normD.includes("standard") || /\bstd\b/.test(normD)) k = "standard";
                      else if (normD.includes("show")) k = "show_dance";
                      
                      discInfo[k] = c.toUpperCase();
                      discs.add(k);
                    }
                  }

                  const [sortedA1Id, sortedA2Id] = [a1Id, a2Id].sort();
                  // We update existing couples rather than upsert everything to be safer
                  const { error } = await supabase
                    .from("couples")
                    .update({
                      disciplines: Array.from(discs),
                      discipline_info: discInfo
                    })
                    .eq("athlete1_id", sortedA1Id)
                    .eq("athlete2_id", sortedA2Id);
                    
                  if (error) {
                    console.error(`Error updating couple ${sortedA1Id}-${sortedA2Id}:`, error);
                  }
              }
          }
      }
  }
  
  console.log(`Finished processing couples.`);
}

run();
