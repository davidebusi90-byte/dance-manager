import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) return new Response(JSON.stringify({ error: "Missing configuration" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(clientIp)) return new Response(JSON.stringify({ error: "Troppe richieste." }), { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "search-athletes") {
      const query = url.searchParams.get("q")?.trim();
      if (!query || query.length < 2) return new Response(JSON.stringify({ error: "Query corta" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      const sanitized = query.replace(/[^a-zA-ZÀ-ÿ0-9\s'-]/g, "").substring(0, 50);
      if (!sanitized) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      const pattern = `%${sanitized}%`;
      const { data, error } = await supabase.from("athletes").select("id, code, first_name, last_name, category, class").or(`first_name.ilike.${pattern},last_name.ilike.${pattern},code.ilike.${pattern}`).limit(20);
      if (error) return new Response(JSON.stringify({ error: "Search error" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (action === "couples") {
      const athleteId = url.searchParams.get("athlete_id");
      if (!athleteId || !uuidRegex.test(athleteId)) return new Response(JSON.stringify({ error: "ID non valido" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      const sel = "id, category, class, disciplines, athlete1:athletes!couples_athlete1_id_fkey (id, code, first_name, last_name, category, class), athlete2:athletes!couples_athlete2_id_fkey (id, code, first_name, last_name, category, class)";
      const [r1, r2] = await Promise.all([
        supabase.from("couples").select(sel).eq("athlete1_id", athleteId).eq("is_active", true),
        supabase.from("couples").select(sel).eq("athlete2_id", athleteId).eq("is_active", true),
      ]);
      if (r1.error || r2.error) return new Response(JSON.stringify({ error: "Couples error" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      return new Response(JSON.stringify({ data: [...(r1.data || []), ...(r2.data || [])] }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (action === "competitions") {
      const coupleId = url.searchParams.get("couple_id");
      if (!coupleId || !uuidRegex.test(coupleId)) return new Response(JSON.stringify({ error: "ID non valido" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      const [cRes, eRes, tRes] = await Promise.all([
        supabase.from("competitions").select("id, name, date, end_date, location, registration_deadline").gte("date", new Date().toISOString().split("T")[0]).order("date", { ascending: true }),
        supabase.from("competition_entries").select("competition_id").eq("couple_id", coupleId).neq("status", "cancelled"),
        supabase.from("competition_event_types").select("id, competition_id, event_name, allowed_classes, min_age, max_age"),
      ]);
      return new Response(JSON.stringify({ competitions: cRes.data || [], existingEntries: (eRes.data || []).map((e: any) => e.competition_id), eventTypes: tRes.data || [] }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: unknown) {
    console.error("error:", error);
    return new Response(JSON.stringify({ error: "Errore interno" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
