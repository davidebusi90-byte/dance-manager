import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

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

interface EnrollmentRequest {
  couple_id: string;
  competition_ids?: string[];
  entries?: {
    competition_id: string;
    event_type_ids: string[];
    disciplines?: string[];
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing backend configuration" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: "Troppe richieste. Riprova tra un'ora." }), { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const body = (await req.json()) as EnrollmentRequest;
    const requestEntries = body.entries || (body.competition_ids || []).map(id => ({ competition_id: id, event_type_ids: [], disciplines: undefined }));

    if (!body.couple_id || requestEntries.length === 0) {
      return new Response(JSON.stringify({ error: "Dati mancanti: couple_id e entries richiesti" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.couple_id)) {
      return new Response(JSON.stringify({ error: "Formato couple_id non valido" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    for (const entry of requestEntries) {
      if (!uuidRegex.test(entry.competition_id)) return new Response(JSON.stringify({ error: "Formato competition_id non valido" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      for (const eventId of (entry.event_type_ids || [])) {
        if (!uuidRegex.test(eventId)) return new Response(JSON.stringify({ error: "Formato event_type_id non valido" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: couple, error: coupleError } = await supabase.from("couples").select("id, class, disciplines, is_active").eq("id", body.couple_id).single();
    if (coupleError || !couple) return new Response(JSON.stringify({ error: "Coppia non trovata" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    if (!couple.is_active) return new Response(JSON.stringify({ error: "La coppia non è attiva" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const competitionIds = requestEntries.map(e => e.competition_id);
    const today = new Date().toISOString().split("T")[0];
    const { data: competitions, error: compError } = await supabase.from("competitions").select("id, name, registration_deadline").in("id", competitionIds);
    if (compError || !competitions || competitions.length === 0) return new Response(JSON.stringify({ error: "Competizioni non trovate" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const closed = competitions.filter(c => c.registration_deadline && c.registration_deadline < today);
    if (closed.length > 0) return new Response(JSON.stringify({ error: `Iscrizioni chiuse per: ${closed.map(c => c.name).join(", ")}` }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const { data: existing } = await supabase.from("competition_entries").select("competition_id").eq("couple_id", body.couple_id).neq("status", "cancelled").in("competition_id", competitionIds);
    const existingIds = new Set(existing?.map(e => e.competition_id) || []);
    const newEntries = requestEntries.filter(e => !existingIds.has(e.competition_id));

    if (newEntries.length === 0) return new Response(JSON.stringify({ error: "La coppia è già iscritta a tutte le gare selezionate" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const dbEntries = newEntries.map(e => ({
      competition_id: e.competition_id,
      couple_id: body.couple_id,
      disciplines: e.disciplines?.length ? e.disciplines : couple.disciplines,
      event_type_ids: e.event_type_ids || [],
      status: "pending",
    }));

    const { error: insertError } = await supabase.from("competition_entries").insert(dbEntries);
    if (insertError) return new Response(JSON.stringify({ error: "Errore durante l'iscrizione" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    console.log(`Enrollment successful: couple=${body.couple_id}, count=${newEntries.length}, ip=${clientIp}`);
    return new Response(JSON.stringify({ ok: true, enrolled_count: newEntries.length, message: `Iscrizione completata per ${newEntries.length} competizione/i` }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (error: unknown) {
    console.error("public-enrollment error:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
