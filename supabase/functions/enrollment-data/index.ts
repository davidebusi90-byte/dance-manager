import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// In-Memory Rate Limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  console.log(`[${requestId}] enrollment-data: Request from IP ${clientIp}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing backend configuration");
    }

    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: "Troppe richieste. Riprova tra un minuto." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Action: Search Athletes
    if (action === "search-athletes") {
      const q = url.searchParams.get("q")?.trim() || "";
      if (q.length < 2) throw new Error("Query troppo breve");

      const sanitized = q.replace(/[^a-zA-ZÀ-ÿ0-9\s'-]/g, "").substring(0, 50);
      const pattern = `%${sanitized}%`;

      const { data, error } = await supabase
        .from("athletes")
        .select("id, code, first_name, last_name, category, class, qr_code, discipline_info")
        .eq("is_deleted", false)
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},code.ilike.${pattern},qr_code.ilike.${pattern}`)
        .limit(20);

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Action: Get Couples for Athlete
    if (action === "couples") {
      const athleteId = url.searchParams.get("athlete_id");
      if (!athleteId || !uuidRegex.test(athleteId)) throw new Error("ID atleta non valido");

      const selectStr = `
        id, category, class, disciplines, discipline_info,
        athlete1:athletes!couples_athlete1_id_fkey (id, code, first_name, last_name, category, class, birth_date, discipline_info),
        athlete2:athletes!couples_athlete2_id_fkey (id, code, first_name, last_name, category, class, birth_date, discipline_info)
      `;

      const [res1, res2] = await Promise.all([
        supabase.from("couples").select(selectStr).eq("athlete1_id", athleteId).eq("is_active", true),
        supabase.from("couples").select(selectStr).eq("athlete2_id", athleteId).eq("is_active", true),
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      return new Response(JSON.stringify({ data: [...(res1.data || []), ...(res2.data || [])] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Action: Get Competitions and Rules
    if (action === "competitions") {
      const coupleId = url.searchParams.get("couple_id");
      if (!coupleId || !uuidRegex.test(coupleId)) throw new Error("ID coppia non valido");

      const today = new Date().toISOString().split("T")[0];
      const [cRes, eRes, tRes] = await Promise.all([
        supabase.from("competitions").select("id, name, date, end_date, location, registration_deadline, late_fee_deadline").eq("is_deleted", false).gte("date", today).order("date", { ascending: true }),
        supabase.from("competition_entries").select("competition_id").eq("couple_id", coupleId).neq("status", "cancelled"),
        supabase.from("competition_event_types").select("id, competition_id, event_name, allowed_classes, min_age, max_age"),
      ]);

      if (cRes.error) throw cRes.error;
      if (eRes.error) throw eRes.error;
      if (tRes.error) throw tRes.error;

      return new Response(JSON.stringify({ 
        competitions: cRes.data || [], 
        existingEntries: (eRes.data || []).map((e: any) => e.competition_id), 
        eventTypes: tRes.data || [] 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    throw new Error("Azione non valida");

  } catch (error: any) {
    console.error(`[${requestId}] enrollment-data: Error:`, error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: error.message?.includes("non valido") || error.message?.includes("Azione") ? 400 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
