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
      // ... same logic as before, just kept correctly scoped ...
      const results = { successful: 0, failed: 0, couples_synced: 0, removed: [] as string[], errors: [] as any[] };
      
      const { data: allAthletes } = await adminClient.from("athletes").select("code, first_name, last_name, is_deleted");
      const incomingCodes = new Set(body.athletes.map(a => String(a.code)));
      
      // Auto-assign CID if missing
      let maxNumericCode = 100000;
      allAthletes?.forEach(a => { if (/^\d+$/.test(a.code)) { const n = parseInt(a.code); if (n > maxNumericCode) maxNumericCode = n; } });

      // --- Phase 1: Sync Athletes ---
      for (const athlete of body.athletes) {
        if (!athlete.code || athlete.code === "undefined") {
          maxNumericCode++;
          athlete.code = String(maxNumericCode);
        }
        
        const discInfo: any = {};
        for(let i=1; i<=6; i++) {
          const d = (athlete as any)[`disc${i}`];
          const c = (athlete as any)[`class${i}`];
          if(d && c) {
            const k = d.toLowerCase().includes("latino") ? "latino" : d.toLowerCase().includes("standard") ? "standard" : "combinata";
            discInfo[k] = discInfo[k] ? getBestClass(discInfo[k], c) : c.toUpperCase();
          }
        }

        const { error } = await adminClient.from("athletes").upsert({
          code: String(athlete.code),
          first_name: athlete.first_name,
          last_name: athlete.last_name,
          birth_date: athlete.birth_date || null,
          gender: athlete.gender || null,
          category: athlete.category,
          class: (athlete.class || "D").toUpperCase(),
          discipline_info: discInfo,
          partner_code: athlete.partner_code || null,
          is_deleted: false,
        }, { onConflict: "code" });

        if (error) {
          results.errors.push({ athlete: athlete.code, error: error.message });
          results.failed++;
        } else {
          results.successful++;
        }
      }

      // --- Phase 3: Sync Couples (Automated) ---
      const { data: currentAthletes } = await adminClient.from("athletes").select("id, code, partner_code").eq("is_deleted", false);
      if (currentAthletes) {
        const athletesByCode = new Map(currentAthletes.map(a => [a.code, a.id]));
        for (const a of currentAthletes) {
          if (a.partner_code && athletesByCode.has(a.partner_code)) {
            const p1 = a.id;
            const p2 = athletesByCode.get(a.partner_code);
            const pair = [p1, p2].sort();
            
            await adminClient.from("couples").upsert({
              athlete1_id: pair[0],
              athlete2_id: pair[1],
              is_active: true,
              is_deleted: false
            }, { onConflict: "athlete1_id, athlete2_id" });
            results.couples_synced++;
          }
        }
      }

      await adminClient.from("sync_logs").insert({
        status: "success",
        message: `Sincronizzazione completata: ${results.successful} atleti e ${results.couples_synced} coppie processate.`,
        raw_payload: body.athletes,
        results: results
      });

      return new Response(JSON.stringify({ message: "Import completed", results }), { status: 200, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
});
