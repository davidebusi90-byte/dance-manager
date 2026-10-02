import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kymoxuucjfgotjlhkfua.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg4Mjg1MSwiZXhwIjoyMDg2NDU4ODUxfQ.sXBf6lqb2b5ugwR7xdqycAR-S4uGF2JDSVhCDNcJY28";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: files, error: err1 } = await supabase.storage.from("api-logs").list();
  if (files && files.length > 0) {
    files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = files[0];
    console.log("Latest log:", latest.name);
    
    const { data: fileData, error: err2 } = await supabase.storage.from("api-logs").download(latest.name);
    if (fileData) {
      const text = await fileData.text();
      const payload = JSON.parse(text);
      
      const ludovico = payload.athletes.find((a: any) => a.first_name?.includes("LUDOVICO"));
      const serena = payload.athletes.find((a: any) => a.first_name?.includes("SERENA"));
      
      console.log("Payload Ludovico:", JSON.stringify(ludovico, null, 2));
      console.log("Payload Serena:", JSON.stringify(serena, null, 2));
    }
  }
}

run();
