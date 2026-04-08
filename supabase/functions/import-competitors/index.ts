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

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing backend configuration" }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  }

  // Security Check
  const EMERGENCY_CLEANUP_SECRET = "MANUAL_FIX_2026_CLEANUP";
  const url = new URL(req.url);
  const mtk = url.searchParams.get("mtk");
  const requestApiKey = req.headers.get("x-api-key") || req.headers.get("X-Api-Key") || mtk;
  
  const isCleanupAction = url.searchParams.get("action") === "manual-cleanup";
  const isLucaFix = url.searchParams.get("action") === "delete-luca-benetti";
  const isEmergencyAuthorized = (isCleanupAction || isLucaFix) && (mtk === EMERGENCY_CLEANUP_SECRET);

  if (importApiKey && !isEmergencyAuthorized) {
    if (requestApiKey !== importApiKey) {
      console.warn(`[${requestId}] import-competitors: Unauthorized access attempt`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Action: Manual Cleanup (Hard Delete)
  if (req.method === "GET" && req.url.includes("action=manual-cleanup")) {
    console.log(`[${requestId}] Running manual cleanup of deactivated athletes`);
    const { data: toDelete, error: fetchError } = await adminClient
      .from("athletes")
      .select("id, first_name, last_name")
      .eq("is_deleted", true);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 400, headers: corsHeaders });
    }

    // Filter out Asia Iannini manually for safety
    const idsToDelete = (toDelete || [])
      .filter(a => {
        const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
        return !fullName.includes("asia iannini") && !fullName.includes("iannini asia");
      })
      .map(d => d.id);

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await adminClient
        .from("athletes")
        .delete()
        .in("id", idsToDelete);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), { status: 400, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ message: "Cleanup completed", removed_count: idsToDelete.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Action: Special Cleanup for Luca Benetti duplicates
  if (req.method === "GET" && req.url.includes("action=delete-luca-benetti")) {
    console.log(`[${requestId}] Running special cleanup for Luca Benetti`);
    
    // Find all records for Luca Benetti
    const { data: lucas, error: lucaError } = await adminClient
      .from("athletes")
      .select("id, code, is_deleted, created_at")
      .ilike("first_name", "Luca")
      .ilike("last_name", "Benetti");

    if (lucaError) throw lucaError;

    if (lucas && lucas.length > 1) {
      // Sort by created_at descending (keep the newest) or keep the non-deleted one
      const sorted = lucas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const toKeep = sorted.find(a => !a.is_deleted) || sorted[0];
      const toDelete = sorted.filter(a => a.id !== toKeep.id);

      if (toDelete.length > 0) {
        const { error: deleteError } = await adminClient
          .from("athletes")
          .delete()
          .in("id", toDelete.map(d => d.id));
        if (deleteError) throw deleteError;
        
        return new Response(JSON.stringify({ message: "Duplicate Luca Benetti records removed", removed_count: toDelete.length }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Also check for duplicate COUPLES for this specific pair
    console.log(`[${requestId}] Checking for duplicate couple records for Luca & Vanessa`);
    const { data: athletes, error: aErr } = await adminClient
      .from("athletes")
      .select("id, code")
      .or(`and(first_name.ilike.Luca,last_name.ilike.Benetti),and(first_name.ilike.Vanessa,last_name.ilike.Bosco)`);

    if (aErr) throw aErr;
    
    const lucaId = athletes?.find(a => a.code === "100195")?.id || athletes?.find(a => a.code.includes("Luca"))?.id;
    const vanessaId = athletes?.find(a => a.code === "108324")?.id || athletes?.find(a => a.code.includes("Vanessa"))?.id;

    if (lucaId && vanessaId) {
      const { data: dupeCouples, error: dcErr } = await adminClient
        .from("couples")
        .select("id, created_at")
        .or(`and(athlete1_id.eq.${lucaId},athlete2_id.eq.${vanessaId}),and(athlete1_id.eq.${vanessaId},athlete2_id.eq.${lucaId})`);

      if (dcErr) throw dcErr;

      if (dupeCouples && dupeCouples.length > 1) {
        const sortedCouples = dupeCouples.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const couplesToDelete = sortedCouples.slice(1); // Keep the newest one

        const { error: delCouplesErr } = await adminClient
          .from("couples")
          .delete()
          .in("id", couplesToDelete.map(c => c.id));
        
        if (delCouplesErr) throw delCouplesErr;

        return new Response(JSON.stringify({ 
          message: "Duplicate Couple record removed for Luca & Vanessa", 
          removed_couples_count: couplesToDelete.length 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    return new Response(JSON.stringify({ message: "No duplicates found for Luca Benetti & Vanessa Bosco" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Action: Standard Import (POST)
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as Body;
      if (!body?.athletes || !Array.isArray(body.athletes)) {
        throw new Error("Invalid payload format");
      }

      // Save Raw Payload to Storage for debugging
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `sync_${timestamp}_${requestId}.json`;
        await adminClient.storage.from('api-logs').upload(filename, JSON.stringify(body, null, 2));
      } catch (e) {
        console.warn(`[${requestId}] import-competitors: Failed to log payload:`, e);
      }

      const results = {
        successful: 0,
        failed: 0,
        couples_synced: 0,
        removed: [] as string[],
        deactivated_couples: 0,
        errors: [] as any[],
      };

      // 1. Pre-fetch and CID logic
      const { data: allAthletes } = await adminClient.from("athletes").select("code, first_name, last_name, is_deleted");
      let maxNumericCode = 100000;
      const nameToCodeMap = new Map<string, string>();

      (allAthletes || []).forEach(a => {
        if (/^\d+$/.test(a.code)) {
          const num = parseInt(a.code, 10);
          if (num > maxNumericCode) maxNumericCode = num;
        }
        const key = `${a.first_name.trim()}-${a.last_name.trim()}`.toLowerCase();
        if (!nameToCodeMap.has(key) || !a.is_deleted) nameToCodeMap.set(key, a.code);
      });

      for (const athlete of body.athletes) {
        let code = athlete.code ? String(athlete.code).trim() : "";
        if (!code || code.toLowerCase() === "undefined") {
          const key = `${String(athlete.first_name).trim()}-${String(athlete.last_name).trim()}`.toLowerCase();
          if (nameToCodeMap.has(key)) {
            code = nameToCodeMap.get(key)!;
          } else {
            maxNumericCode++;
            code = String(maxNumericCode);
            nameToCodeMap.set(key, code);
          }
          athlete.code = code;
        }
      }

      // 2. Soft-delete missing athletes
      const incomingCodes = new Set(body.athletes.map(a => a.code));
      const currentActiveCodes = (allAthletes || []).filter(a => !a.is_deleted).map(a => a.code);
      const missingCodes = currentActiveCodes.filter(c => !incomingCodes.has(c));

      if (missingCodes.length > 0) {
        await adminClient.from("athletes").update({ is_deleted: true }).in("code", missingCodes);
        results.removed = missingCodes;
      }

      // 3. Process Athletes
      for (const athlete of body.athletes) {
        try {
          const disciplines: any[] = [];
          const disciplineInfo: Record<string, string> = {};
          for (let i = 1; i <= 6; i++) {
            const disc = (athlete as any)[`disc${i}`];
            const cls = (athlete as any)[`class${i}`];
            if (disc && cls) {
              disciplines.push({ discipline: disc, class: cls });
              const key = disc.toLowerCase().includes("latino") ? "latino" : disc.toLowerCase().includes("standard") ? "standard" : disc.toLowerCase().includes("combinata") ? "combinata" : disc.toLowerCase();
              disciplineInfo[key] = disciplineInfo[key] ? getBestClass(disciplineInfo[key], cls) : cls.toUpperCase();
            }
          }

          const bestClass = athlete.class || disciplines.reduce((acc, curr) => getBestClass(acc, curr.class), "D");
          const responsabili = [athlete.resp1, athlete.resp2, athlete.resp3, athlete.resp4].filter(Boolean);

          const { error } = await adminClient.from("athletes").upsert({
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
            responsabili: responsabili.length ? responsabili : null,
            notes: athlete.notes || null,
            qr_code: athlete.qr_code || null,
            is_deleted: false, // Ensure they are active if in payload
          }, { onConflict: "code" });

          if (error) throw error;
          results.successful++;
        } catch (e: any) {
          results.failed++;
          results.errors.push({ code: athlete.code, error: e.message });
        }
      }

      // 4. Process Couples
      const { data: dbAthletes } = await adminClient.from("athletes").select("id, code");
      const athleteMap = new Map((dbAthletes || []).map(a => [a.code, a.id]));
      const couplesToUpsert: any[] = [];
      const pairKeys = new Set<string>();

      for (const athlete of body.athletes) {
        if (!athlete.partner_code) continue;
        const a1Id = athleteMap.get(athlete.code);
        const a2Id = athleteMap.get(athlete.partner_code);
        if (!a1Id || !a2Id) continue;

        const key = [athlete.code, athlete.partner_code].sort().join("-");
        if (pairKeys.has(key)) continue;
        pairKeys.add(key);

        const discList: string[] = [];
        const discInfo: Record<string, string> = {};
        let cBest = "D";
        for (let i = 1; i <= 6; i++) {
          const d = (athlete as any)[`disc${i}`];
          const c = (athlete as any)[`class${i}`];
          if (d && c) {
            const k = d.toLowerCase().includes("latino") ? "latino" : d.toLowerCase().includes("standard") ? "standard" : d.toLowerCase().includes("combinata") ? "combinata" : d.toLowerCase();
            discInfo[k] = discInfo[k] ? getBestClass(discInfo[k], c) : c.toUpperCase();
            cBest = getBestClass(cBest, c);
            if (["latino", "standard", "combinata"].includes(k)) discList.push(k);
          }
        }

        couplesToUpsert.push({
          athlete1_id: a1Id,
          athlete2_id: a2Id,
          category: athlete.category,
          class: cBest,
          disciplines: Array.from(new Set(discList)),
          discipline_info: discInfo,
          is_active: true,
        });
      }

      if (couplesToUpsert.length > 0) {
        const { data: activeCouples } = await adminClient.from("couples").select("id, athlete1_id, athlete2_id").eq("is_active", true);
        if (activeCouples) {
          const newPairs = new Set(couplesToUpsert.map(c => `${c.athlete1_id}-${c.athlete2_id}`));
          const toDeactivate = activeCouples.filter(c => !newPairs.has(`${c.athlete1_id}-${c.athlete2_id}`));
          if (toDeactivate.length) {
            await adminClient.from("couples").update({ is_active: false }).in("id", toDeactivate.map(c => c.id));
            results.deactivated_couples = toDeactivate.length;
          }
        }
        await adminClient.from("couples").upsert(couplesToUpsert, { onConflict: "athlete1_id,athlete2_id" });
        results.couples_synced = couplesToUpsert.length;
      }

      // 5. Final Log
      const syncMessage = `Sincronizzazione completata: ${results.successful} atleti, ${results.couples_synced} coppie.`;
      await adminClient.from("sync_logs").insert({
        status: results.failed > 0 ? "warning" : "success",
        message: syncMessage,
        results
      });

      return new Response(JSON.stringify({ message: "Import completed", results }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
