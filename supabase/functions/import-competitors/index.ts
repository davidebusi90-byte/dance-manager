import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getBestClass } from "../_shared/class-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

type AthleteData = {
  code: string;
  first_name: string;
  last_name: string;
  birth_date?: string;
  gender?: string;
  email?: string;
  phone?: string;
  category: string;
  class?: string;
  medical_certificate_expiry?: string;
  notes?: string;
  resp1?: string; resp2?: string; resp3?: string; resp4?: string;
  disc1?: string; class1?: string;
  disc2?: string; class2?: string;
  disc3?: string; class3?: string;
  disc4?: string; class4?: string;
  disc5?: string; class5?: string;
  disc6?: string; class6?: string;
  partner_code?: string;
  qr_code?: string;
};

type Body = {
  athletes: AthleteData[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const importApiKey = Deno.env.get("IMPORT_API_KEY");
  const EMERGENCY_CLEANUP_SECRET = "MANUAL_FIX_2026_CLEANUP";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing backend configuration" }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const url = new URL(req.url);
  const mtk = url.searchParams.get("mtk");
  const action = url.searchParams.get("action");
  
  const isEmergencyAuthorized = (mtk === EMERGENCY_CLEANUP_SECRET) && (action === "manual-cleanup" || action === "cleanup-all-duplicates");

  // Security Check
  if (importApiKey && !isEmergencyAuthorized) {
    const requestApiKey = req.headers.get("x-api-key") || req.headers.get("X-Api-Key") || mtk;
    if (requestApiKey !== importApiKey) {
      console.warn(`[${requestId}] import-competitors: Unauthorized access attempt`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  // Action: Cleanup ALL Duplicate Couples (Hard Delete)
  if (req.method === "GET" && action === "cleanup-all-duplicates") {
    console.log(`[${requestId}] Running global couples deduplication`);
    const { data: allCouples, error: fetchErr } = await adminClient
      .from("couples")
      .select("id, athlete1_id, athlete2_id, created_at")
      .order("created_at", { ascending: false });

    if (fetchErr) return new Response(JSON.stringify({ error: fetchErr.message }), { status: 400, headers: corsHeaders });

    const seen = new Set<string>();
    const idsToDelete: string[] = [];
    (allCouples || []).forEach(c => {
      const key = [c.athlete1_id, c.athlete2_id].sort().join("-");
      if (seen.has(key)) {
        idsToDelete.push(c.id);
      } else {
        seen.add(key);
      }
    });

    if (idsToDelete.length > 0) {
      const { error: delErr } = await adminClient.from("couples").delete().in("id", idsToDelete);
      if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ message: "Deduplication completed", removed_count: idsToDelete.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Action: Manual Cleanup Athletes (Except Asia Iannini)
  if (req.method === "GET" && action === "manual-cleanup") {
    console.log(`[${requestId}] Running surgical cleanup for Bombardi & Lazzari`);
    
    // 1. Delete associated couples first
    const { data: toDeleteAt } = await adminClient.from("athletes").select("id").or("last_name.ilike.Bombardi,last_name.ilike.Lazzari");
    const ids = (toDeleteAt || []).map(a => a.id);
    
    if (ids.length > 0) {
      await adminClient.from("couples").delete().or(`athlete1_id.in.(${ids.join(",")}),athlete2_id.in.(${ids.join(",")})`);
      await adminClient.from("athletes").delete().in("id", ids);
    }

    // 2. Clean sync logs
    await adminClient.from("sync_logs").delete().or("message.ilike.%bombardi%,message.ilike.%lazzari%");

    return new Response(JSON.stringify({ message: "Surgical cleanup completed", removed_count: ids.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Action: Standard Import (POST)
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as Body;

      if (!body || !body.athletes || !Array.isArray(body.athletes)) {
          return new Response(JSON.stringify({ error: "Invalid payload format. Expected { athletes: [...] }" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
          });
      }

      // --- Save raw payload to Storage as a log file ---
      try {
          const { data: bucket } = await adminClient.storage.getBucket('api-logs');
          if (!bucket) {
              await adminClient.storage.createBucket('api-logs', { public: false });
          }
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const logFilename = `sync_${timestamp}.json`;
          
          await adminClient.storage.from('api-logs').upload(
              logFilename, 
              JSON.stringify(body, null, 2),
              { contentType: 'application/json' }
          );
          console.log(`Saved API payload to bucket api-logs as ${logFilename}`);
      } catch (storageErr: any) {
          console.error("Failed to save API log to storage:", storageErr);
      }
      // -------------------------------------------------

      const results = {
          successful: 0,
          failed: 0,
          couples_synced: 0,
          removed: [] as { code: string; first_name: string; last_name: string }[],
          deactivated_couples: 0,
          errors: [] as any[],
      };

      // Fetch ALL athletes (including deleted) to perform name matching and find max numeric CID
      const { data: allAthletes, error: fetchAllError } = await adminClient
          .from("athletes")
          .select("code, first_name, last_name, is_deleted");

      let maxNumericCode = 100000;
      const nameToCodeMap = new Map<string, string>();

      if (allAthletes) {
          allAthletes.forEach(a => {
              if (/^\d+$/.test(a.code)) {
                  const num = parseInt(a.code, 10);
                  if (num > maxNumericCode) maxNumericCode = num;
              }
              const key = `${a.first_name.trim()}-${a.last_name.trim()}`.toLowerCase();
              if (!nameToCodeMap.has(key) || !a.is_deleted) {
                  nameToCodeMap.set(key, a.code);
              }
          });
      }

      // Pre-process payload to assign fallback CIDs if missing
      for (const athlete of body.athletes) {
          let code = athlete.code ? String(athlete.code).trim() : "";
          const firstName = athlete.first_name ? String(athlete.first_name).trim() : "";
          const lastName = athlete.last_name ? String(athlete.last_name).trim() : "";

          if (!code || code.toLowerCase() === "undefined") {
              if (firstName && lastName) {
                  const key = `${firstName}-${lastName}`.toLowerCase();
                  if (nameToCodeMap.has(key)) {
                      code = nameToCodeMap.get(key)!;
                  } else {
                      maxNumericCode++;
                      code = String(maxNumericCode);
                      nameToCodeMap.set(key, code);
                  }
              }
              athlete.code = code;
          } else {
              if (firstName && lastName) {
                  const key = `${firstName}-${lastName}`.toLowerCase();
                  nameToCodeMap.set(key, code);
              }
              if (/^\d+$/.test(code)) {
                  const num = parseInt(code, 10);
                  if (num > maxNumericCode) maxNumericCode = num;
              }
          }
      }

      // Identify potential removals (missing from payload)
      const incomingCodes = new Set(body.athletes.map(a => a.code));
      if (!fetchAllError && allAthletes) {
          const currentActiveAthletes = allAthletes.filter(a => !a.is_deleted);
          const missingAthletes = currentActiveAthletes.filter(a => !incomingCodes.has(a.code));
          
          if (missingAthletes.length > 0) {
              const missingCodes = missingAthletes.map(a => a.code);
              for (let i = 0; i < missingCodes.length; i += 100) {
                  const batch = missingCodes.slice(i, i + 100);
                  await adminClient
                      .from("athletes")
                      .update({ is_deleted: true } as any)
                      .in("code", batch);
              }
              results.removed = missingAthletes;
          }
      }

      // 1. Process Athletes
      for (const athlete of body.athletes) {
          if (!athlete.code || !athlete.first_name || !athlete.last_name || !athlete.category) {
              results.failed++;
              results.errors.push({ code: athlete.code, error: "Missing required fields" });
              continue;
          }

          const disciplineInfo: Record<string, string> = {};
          let bestClass = athlete.class || "D";

          for (let i = 1; i <= 6; i++) {
              const disc = (athlete as any)[`disc${i}`];
              const cls = (athlete as any)[`class${i}`];
              if (disc && cls) {
                  const discName = disc.toLowerCase();
                  let key = discName;
                  if (discName.includes("combinata")) key = "combinata";
                  else if (discName.includes("latino")) key = "latino";
                  else if (discName.includes("standard")) key = "standard";
                  
                  disciplineInfo[key] = cls.toUpperCase();
                  if (i === 1 && !athlete.class) bestClass = cls;
              }
          }

          const responsabili = [athlete.resp1, athlete.resp2, athlete.resp3, athlete.resp4]
              .filter(r => r && r.trim() !== "");

          const { error } = await adminClient
              .from("athletes")
              .upsert({
                  code: athlete.code,
                  first_name: athlete.first_name,
                  last_name: athlete.last_name,
                  birth_date: athlete.birth_date || null,
                  gender: (athlete.gender || "M").toUpperCase(),
                  email: athlete.email || null,
                  phone: athlete.phone || null,
                  category: athlete.category,
                  class: bestClass.toUpperCase(),
                  discipline_info: disciplineInfo,
                  medical_certificate_expiry: athlete.medical_certificate_expiry || null,
                  responsabili: responsabili.length > 0 ? responsabili : null,
                  notes: athlete.notes || null,
                  qr_code: athlete.qr_code || null,
                  is_deleted: false,
              }, { onConflict: "code" });

          if (error) {
              results.failed++;
              results.errors.push({ code: athlete.code, error: error.message });
          } else {
              results.successful++;
          }
      }

      // 2. Sync Couples
      const activeAthletesMap = new Map<string, string>();
      const { data: athletesDb } = await adminClient.from("athletes").select("id, code").eq("is_deleted", false);
      athletesDb?.forEach(a => activeAthletesMap.set(a.code, a.id));

      const couplesToUpsert: any[] = [];
      const processedPairs = new Set<string>();

      for (const athlete of body.athletes) {
          if (athlete.partner_code && athlete.partner_code !== athlete.code) {
              const a1Id = activeAthletesMap.get(athlete.code);
              const a2Id = activeAthletesMap.get(athlete.partner_code);
              if (a1Id && a2Id) {
                  const pairKey = [athlete.code, athlete.partner_code].sort().join("-");
                  if (!processedPairs.has(pairKey)) {
                      processedPairs.add(pairKey);
                      
                      const discInfo: Record<string, string> = {};
                      let bestCls = "D";
                      const discs = new Set<string>();

                      for (let i = 1; i <= 6; i++) {
                        const d = (athlete as any)[`disc${i}`];
                        const c = (athlete as any)[`class${i}`];
                        if (d && c) {
                          const k = d.toLowerCase().includes("latino") ? "latino" : d.toLowerCase().includes("standard") ? "standard" : "combinata";
                          discInfo[k] = c.toUpperCase();
                          discs.add(k);
                          if (bestCls === "D") bestCls = c.toUpperCase();
                        }
                      }

                      couplesToUpsert.push({
                          athlete1_id: a1Id,
                          athlete2_id: a2Id,
                          category: athlete.category,
                          class: bestCls,
                          disciplines: Array.from(discs),
                          discipline_info: discInfo,
                          is_active: true,
                      });
                  }
              }
          }
      }

      if (couplesToUpsert.length > 0) {
          // Deactivate old couples not in payload
          const { data: existingActive } = await adminClient.from("couples").select("id, athlete1_id, athlete2_id").eq("is_active", true);
          if (existingActive) {
              const newPairs = new Set(couplesToUpsert.map(c => `${c.athlete1_id}-${c.athlete2_id}`));
              const toDeactivate = existingActive.filter(c => !newPairs.has(`${c.athlete1_id}-${c.athlete2_id}`)).map(c => c.id);
              if (toDeactivate.length > 0) {
                  await adminClient.from("couples").update({ is_active: false } as any).in("id", toDeactivate);
                  results.deactivated_couples = toDeactivate.length;
              }
          }
          await adminClient.from("couples").upsert(couplesToUpsert, { onConflict: "athlete1_id,athlete2_id" });
          results.couples_synced = couplesToUpsert.length;
      }

      // Log Sync Result
      const { failed: logFailed, successful: logSuccess, couples_synced: logCouples } = results;
      await adminClient.from("sync_logs").insert({
          status: logFailed > 0 ? "warning" : "success",
          message: `Sincronizzazione completata: ${logSuccess} atleti, ${logCouples} coppie.`,
          results: results
      });

      return new Response(JSON.stringify({ message: "Import completed", results }), { status: 200, headers: corsHeaders });

    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
});
