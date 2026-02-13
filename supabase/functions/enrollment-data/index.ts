import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting for search endpoint
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

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

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    // Rate limit check
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: "Troppe richieste. Riprova tra poco." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Action: search athletes (returns only non-sensitive fields)
    if (action === "search-athletes") {
      const query = url.searchParams.get("q")?.trim();
      if (!query || query.length < 2) {
        return new Response(JSON.stringify({ error: "Query troppo corta" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      // Sanitize: only allow alphanumeric, spaces, hyphens, apostrophes
      const sanitized = query.replace(/[^a-zA-ZÀ-ÿ0-9\s'-]/g, "").substring(0, 50);
      if (!sanitized) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Use separate filter queries instead of string interpolation in .or()
      const searchPattern = `%${sanitized}%`;
      const { data, error } = await supabase
        .from("athletes")
        .select("id, code, first_name, last_name, category, class")
        .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},code.ilike.${searchPattern}`)
        .limit(20);

      if (error) {
        console.error("Search error:", error);
        return new Response(JSON.stringify({ error: "Errore nella ricerca" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Action: get couples for athlete
    if (action === "couples") {
      const athleteId = url.searchParams.get("athlete_id");
      if (!athleteId || !uuidRegex.test(athleteId)) {
        return new Response(JSON.stringify({ error: "athlete_id non valido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Use two separate queries instead of string interpolation in .or()
      const [result1, result2] = await Promise.all([
        supabase
          .from("couples")
          .select(`
            id, category, class, disciplines,
            athlete1:athletes!couples_athlete1_id_fkey (id, code, first_name, last_name, category, class),
            athlete2:athletes!couples_athlete2_id_fkey (id, code, first_name, last_name, category, class)
          `)
          .eq("athlete1_id", athleteId)
          .eq("is_active", true),
        supabase
          .from("couples")
          .select(`
            id, category, class, disciplines,
            athlete1:athletes!couples_athlete1_id_fkey (id, code, first_name, last_name, category, class),
            athlete2:athletes!couples_athlete2_id_fkey (id, code, first_name, last_name, category, class)
          `)
          .eq("athlete2_id", athleteId)
          .eq("is_active", true),
      ]);

      if (result1.error || result2.error) {
        console.error("Couples error:", result1.error || result2.error);
        return new Response(JSON.stringify({ error: "Errore nel caricamento coppie" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const data = [...(result1.data || []), ...(result2.data || [])];

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Action: get competitions + class rules + existing entries
    if (action === "competitions") {
      const coupleId = url.searchParams.get("couple_id");
      if (!coupleId || !uuidRegex.test(coupleId)) {
        return new Response(JSON.stringify({ error: "couple_id non valido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const today = new Date().toISOString().split("T")[0];

      const [compResult, rulesResult, entriesResult, eventTypesResult] = await Promise.all([
        supabase
          .from("competitions")
          .select("id, name, date, end_date, location, registration_deadline")
          .gte("date", today)
          .order("date", { ascending: true }),
        supabase
          .from("competition_class_rules")
          .select("competition_id, class, is_allowed"),
        supabase
          .from("competition_entries")
          .select("competition_id")
          .eq("couple_id", coupleId)
          .neq("status", "cancelled"),
        supabase
          .from("competition_event_types")
          .select("id, competition_id, event_name, allowed_classes, min_age, max_age"),
      ]);

      return new Response(JSON.stringify({
        competitions: compResult.data || [],
        classRules: rulesResult.data || [],
        existingEntries: (entriesResult.data || []).map((e: any) => e.competition_id),
        eventTypes: eventTypesResult.data || [],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error("enrollment-data error:", error);
    return new Response(JSON.stringify({ error: "Errore interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
