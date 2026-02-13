import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(JSON.stringify({ error: "Troppe richieste. Riprova tra un'ora." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as EnrollmentRequest;

    // Normalize input
    const requestEntries = body.entries || (body.competition_ids || []).map(id => ({
      competition_id: id,
      event_type_ids: [],
      disciplines: undefined
    }));

    // Validate required fields
    if (!body.couple_id || requestEntries.length === 0) {
      return new Response(JSON.stringify({ error: "Dati mancanti: couple_id e entries richiesti" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.couple_id)) {
      return new Response(JSON.stringify({ error: "Formato couple_id non valido" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    for (const entry of requestEntries) {
      if (!uuidRegex.test(entry.competition_id)) {
        return new Response(JSON.stringify({ error: "Formato competition_id non valido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      for (const eventId of (entry.event_type_ids || [])) {
        if (!uuidRegex.test(eventId)) {
          return new Response(JSON.stringify({ error: "Formato event_type_id non valido" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Validate couple exists and is active
    const { data: couple, error: coupleError } = await supabase
      .from("couples")
      .select("id, class, disciplines, is_active")
      .eq("id", body.couple_id)
      .single();

    if (coupleError || !couple) {
      return new Response(JSON.stringify({ error: "Coppia non trovata" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!couple.is_active) {
      return new Response(JSON.stringify({ error: "La coppia non è attiva" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Validate competitions exist and are accepting registrations
    const competitionIds = requestEntries.map(e => e.competition_id);
    const today = new Date().toISOString().split("T")[0];
    const { data: competitions, error: compError } = await supabase
      .from("competitions")
      .select("id, name, registration_deadline")
      .in("id", competitionIds);

    if (compError || !competitions || competitions.length === 0) {
      return new Response(JSON.stringify({ error: "Competizioni non trovate" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check registration deadlines
    const closedCompetitions = competitions.filter(
      (c) => c.registration_deadline && c.registration_deadline < today
    );
    if (closedCompetitions.length > 0) {
      return new Response(JSON.stringify({
        error: `Iscrizioni chiuse per: ${closedCompetitions.map(c => c.name).join(", ")}`
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 3. Check class rules for each competition
    const { data: classRules } = await supabase
      .from("competition_class_rules")
      .select("competition_id, class, is_allowed")
      .in("competition_id", competitionIds);

    const disallowedCompetitions: string[] = [];
    for (const comp of competitions) {
      const rules = classRules?.filter((r) => r.competition_id === comp.id) || [];
      if (rules.length > 0) {
        const classRule = rules.find((r) => r.class === couple.class);
        if (classRule && !classRule.is_allowed) {
          disallowedCompetitions.push(comp.name);
        }
      }
    }

    if (disallowedCompetitions.length > 0) {
      return new Response(JSON.stringify({
        error: `Classe non ammessa per: ${disallowedCompetitions.join(", ")}`
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 4. Check for existing entries (by competition_id and couple_id)
    const { data: existingEntries } = await supabase
      .from("competition_entries")
      .select("competition_id")
      .eq("couple_id", body.couple_id)
      .neq("status", "cancelled")
      .in("competition_id", competitionIds);

    const existingCompIds = new Set(existingEntries?.map((e) => e.competition_id) || []);
    const newEntriesToCreate = requestEntries.filter((e) => !existingCompIds.has(e.competition_id));

    if (newEntriesToCreate.length === 0) {
      return new Response(JSON.stringify({ error: "La coppia è già iscritta a tutte le gare selezionate" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 5. Create entries
    const dbEntries = newEntriesToCreate.map((e) => ({
      competition_id: e.competition_id,
      couple_id: body.couple_id,
      // Use user-selected disciplines if provided, otherwise use all couple disciplines
      disciplines: e.disciplines && e.disciplines.length > 0 ? e.disciplines : couple.disciplines,
      event_type_ids: e.event_type_ids || [],
      status: "pending",
    }));

    const { error: insertError } = await supabase
      .from("competition_entries")
      .insert(dbEntries);

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Errore durante l'iscrizione" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Log the enrollment for audit
    console.log(`Enrollment successful: couple=${body.couple_id}, entries=${JSON.stringify(newEntriesToCreate)}, ip=${clientIp}, timestamp=${new Date().toISOString()}`);

    return new Response(JSON.stringify({
      ok: true,
      enrolled_count: newEntriesToCreate.length,
      message: `Iscrizione completata per ${newEntriesToCreate.length} competizione/i`
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error("public-enrollment error:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
