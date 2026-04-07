import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getEnrollmentConfirmationHtml } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple In-Memory Rate Limiting
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
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

interface EnrollmentRequest {
  couple_id: string;
  entries?: {
    competition_id: string;
    event_type_ids: string[];
    disciplines?: string[];
  }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  
  console.log(`[${requestId}] public-enrollment: Request from IP ${clientIp}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing backend configuration");
    }

    // 1. Rate Limiting
    if (!checkRateLimit(clientIp)) {
      console.warn(`[${requestId}] public-enrollment: Rate limit exceeded for IP ${clientIp}`);
      return new Response(JSON.stringify({ error: "Troppe richieste. Riprova tra un'ora." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as EnrollmentRequest;
    if (!body.couple_id || !body.entries?.length) {
      throw new Error("Dati mancanti: couple_id e entries richiesti");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Fetch Couple Data
    const { data: couple, error: coupleError } = await supabase
      .from("couples")
      .select(`
        id, class, disciplines, is_active,
        athlete1:athletes!couples_athlete1_id_fkey(first_name, last_name, email, responsabili),
        athlete2:athletes!couples_athlete2_id_fkey(first_name, last_name, email, responsabili),
        instructor:profiles!couples_instructor_id_fkey(full_name, email)
      `)
      .eq("id", body.couple_id)
      .single();

    if (coupleError || !couple) throw new Error("Coppia non trovata");
    if (!couple.is_active) throw new Error("La coppia non è attiva");

    // 3. Validate Competitions & Deadlines
    const competitionIds = body.entries.map(e => e.competition_id);
    const today = new Date().toISOString().split("T")[0];
    
    const { data: competitions, error: compError } = await supabase
      .from("competitions")
      .select("id, name, registration_deadline, late_fee_deadline")
      .in("id", competitionIds);

    if (compError || !competitions?.length) throw new Error("Competizioni non trovate");

    const closed = competitions.filter(c => {
      const deadline = c.late_fee_deadline || c.registration_deadline;
      return deadline && deadline < today;
    });

    if (closed.length > 0) {
      throw new Error(`Iscrizioni chiuse per: ${closed.map(c => c.name).join(", ")}`);
    }

    // 4. Filter existing entries
    const { data: existing } = await supabase
      .from("competition_entries")
      .select("competition_id")
      .eq("couple_id", body.couple_id)
      .neq("status", "cancelled")
      .in("competition_id", competitionIds);

    const existingIds = new Set(existing?.map(e => e.competition_id) || []);
    const newEntries = body.entries.filter(e => !existingIds.has(e.competition_id));

    if (newEntries.length === 0) {
      throw new Error("La coppia è già iscritta a tutte le gare selezionate");
    }

    // 5. Insert Entries
    const dbEntries = newEntries.map(e => ({
      competition_id: e.competition_id,
      couple_id: body.couple_id,
      disciplines: e.disciplines?.length ? e.disciplines : couple.disciplines,
      event_type_ids: e.event_type_ids || [],
      status: "pending",
    }));

    const { error: insertError } = await supabase.from("competition_entries").insert(dbEntries);
    if (insertError) throw insertError;

    console.log(`[${requestId}] public-enrollment: Enrollment successful for ${body.couple_id}`);

    // 6. Email Notifications
    await handleNotifications(supabase, brevoApiKey, couple, newEntries, competitions, requestId);

    return new Response(JSON.stringify({ 
      ok: true, 
      enrolled_count: newEntries.length, 
      message: `Iscrizione completata per ${newEntries.length} competizione/i` 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error(`[${requestId}] public-enrollment: Error:`, error);
    return new Response(JSON.stringify({ error: error.message || "Errore interno" }), {
      status: error.message?.includes("mancanti") || error.message?.includes("chiuse") ? 400 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

async function handleNotifications(
  supabase: any, 
  brevoApiKey: string | undefined, 
  couple: any, 
  newEntries: any[], 
  competitions: any[],
  requestId: string
) {
  try {
    const { data: settings } = await supabase
      .from("system_settings")
      .select("email_notifications_athletes, email_notifications_instructors")
      .eq("id", "global")
      .single();

    const emailSettings = settings || { email_notifications_athletes: true, email_notifications_instructors: true };
    const emailSet = new Set<string>();

    if (emailSettings.email_notifications_athletes) {
      if (couple.athlete1?.email) emailSet.add(couple.athlete1.email);
      if (couple.athlete2?.email) emailSet.add(couple.athlete2.email);
    }

    if (emailSettings.email_notifications_instructors) {
      if (couple.instructor?.email) emailSet.add(couple.instructor.email);
    }

    const responsabiliNames = [
      ...(couple.athlete1?.responsabili || []), 
      ...(couple.athlete2?.responsabili || [])
    ].filter(Boolean);

    if (responsabiliNames.length > 0) {
      const { data: respProfiles } = await supabase.from("profiles").select("email").in("full_name", responsabiliNames);
      (respProfiles || []).forEach((p: any) => { if (p.email) emailSet.add(p.email); });
    }

    if (emailSet.size > 0 && brevoApiKey) {
      // Fetch event type names
      const allEventTypeIds = Array.from(new Set(newEntries.flatMap(e => e.event_type_ids || [])));
      let eventTypeNamesMap: Record<string, string> = {};
      if (allEventTypeIds.length > 0) {
        const { data: etData } = await supabase.from("competition_event_types").select("id, event_name").in("id", allEventTypeIds);
        eventTypeNamesMap = Object.fromEntries((etData || []).map((et: any) => [et.id, et.event_name]));
      }

      const a1Name = `${couple.athlete1?.first_name || ""} ${couple.athlete1?.last_name || ""}`.trim();
      const a2Name = `${couple.athlete2?.first_name || ""} ${couple.athlete2?.last_name || ""}`.trim();
      const coupleName = `${a1Name} / ${a2Name}`;

      const competitionsHtml = newEntries.map(e => {
        const comp = competitions.find(c => c.id === e.competition_id);
        const compName = comp ? comp.name : "Competizione";
        const events = (e.event_type_ids || []).map(id => eventTypeNamesMap[id] || "Gara").join(", ");
        return `
          <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #4f46e5; background-color: #f8faff; border-radius: 0 8px 8px 0;">
            <h3 style="margin: 0 0 5px 0; color: #1e1b4b; font-size: 16px;">${compName}</h3>
            <p style="margin: 0; color: #4338ca; font-size: 14px;"><strong>Gare:</strong> ${events || "Programma standard"}</p>
            ${e.disciplines?.length ? `<p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Discipline: ${e.disciplines.join(", ")}</p>` : ""}
          </div>
        `;
      }).join("");

      const html = getEnrollmentConfirmationHtml(coupleName, competitionsHtml);

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoApiKey
        },
        body: JSON.stringify({
          sender: { name: "Dance Manager", email: "ufficiogare@ritmodanza.net" },
          to: [{ email: "info@antigravity.it" }], // Should probably be customizable
          bcc: Array.from(emailSet).map(email => ({ email })),
          subject: `Iscrizione Gare: ${coupleName}`,
          htmlContent: html
        }),
      });

      if (!res.ok) {
        console.error(`[${requestId}] public-enrollment: Brevo error:`, await res.text());
      } else {
        console.log(`[${requestId}] public-enrollment: Notification sent to ${emailSet.size} recipients`);
      }
    }
  } catch (err) {
    console.error(`[${requestId}] public-enrollment: Notification error:`, err);
  }
}
