import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { getEnrollmentConfirmationHtml } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-platform, x-supabase-client-runtime-version",
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
    if (coupleError || !couple) return new Response(JSON.stringify({ error: "Coppia non trovata" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    if (!couple.is_active) return new Response(JSON.stringify({ error: "La coppia non è attiva" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const competitionIds = requestEntries.map(e => e.competition_id);
    const today = new Date().toISOString().split("T")[0];
    const { data: competitions, error: compError } = await supabase.from("competitions").select("id, name, registration_deadline, late_fee_deadline").in("id", competitionIds);
    if (compError || !competitions || competitions.length === 0) return new Response(JSON.stringify({ error: "Competizioni non trovate" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const closed = competitions.filter(c => {
      const deadline = c.late_fee_deadline || c.registration_deadline;
      return deadline && deadline < today;
    });
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

    // Fetch system settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("email_notifications_athletes, email_notifications_instructors")
      .eq("id", "global")
      .single();

    const emailSettings = settings || { email_notifications_athletes: true, email_notifications_instructors: true };

    // Send email notification
    try {
      const emailSet = new Set<string>();
      // @ts-ignore - Supabase type casting workaround
      const c = couple as any;

      if (emailSettings.email_notifications_athletes) {
        if (c?.athlete1?.email) emailSet.add(c.athlete1.email);
        if (c?.athlete2?.email) emailSet.add(c.athlete2.email);
      }

      if (emailSettings.email_notifications_instructors) {
        if (c?.instructor?.email) emailSet.add(c.instructor.email);
      }

      const responsabiliNames = [...(c?.athlete1?.responsabili || []), ...(c?.athlete2?.responsabili || [])].filter(Boolean);
      if (responsabiliNames.length > 0) {
        const { data: respProfiles } = await supabase.from("profiles").select("email").in("full_name", responsabiliNames);
        (respProfiles || []).forEach((p: any) => { if (p.email) emailSet.add(p.email); });
      }

      if (emailSet.size > 0) {
        // Fetch event type names for the email
        const allEventTypeIds = Array.from(new Set(newEntries.flatMap(e => e.event_type_ids || [])));
        let eventTypeNamesMap: Record<string, string> = {};
        if (allEventTypeIds.length > 0) {
          const { data: etData } = await supabase.from("event_types").select("id, name").in("id", allEventTypeIds);
          eventTypeNamesMap = Object.fromEntries((etData || []).map(et => [et.id, et.name]));
        }

        const a1Name = `${c?.athlete1?.first_name || ""} ${c?.athlete1?.last_name || ""}`.trim();
        const a2Name = `${c?.athlete2?.first_name || ""} ${c?.athlete2?.last_name || ""}`.trim();
        const coupleName = `${a1Name} / ${a2Name}`;

        const competitionsHtml = newEntries.map(e => {
          const comp = competitions?.find((comp: any) => comp.id === e.competition_id);
          const compName = comp ? comp.name : "Competizione Sconosciuta";
          const events = (e.event_type_ids || []).map(id => eventTypeNamesMap[id] || "Gara").join(", ");
          return `
            <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #4f46e5; background-color: #f8faff; border-radius: 0 8px 8px 0;">
              <h3 style="margin: 0 0 5px 0; color: #1e1b4b; font-size: 16px;">${compName}</h3>
              <p style="margin: 0; color: #4338ca; font-size: 14px;"><strong>Gare:</strong> ${events || "Tutto il programma previsto"}</p>
              ${e.disciplines?.length ? `<p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Discipline: ${e.disciplines.join(", ")}</p>` : ""}
            </div>
          `;
        }).join("");

        const html = getEnrollmentConfirmationHtml(coupleName, competitionsHtml);

        const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO_API_KEY || ""
          },
          body: JSON.stringify({
            sender: { name: "Dance Manager", email: "ufficiogare@ritmodanza.net" },
            to: [{ email: "info@antigravity.it" }],
            bcc: Array.from(emailSet).map(email => ({ email })),
            subject: `Iscrizione Gare: ${coupleName}`,
            htmlContent: html
          }),
        });

        if (!res.ok) {
          console.error("Failed to send email via Brevo:", await res.text());
        } else {
          console.log(`Email notification sent to ${emailSet.size} recipients`);
        }
      }
    } catch (emailErr) {
      console.error("Error sending enrollment email:", emailErr);
    }

    return new Response(JSON.stringify({ ok: true, enrolled_count: newEntries.length, message: `Iscrizione completata per ${newEntries.length} competizione/i` }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (error: unknown) {
    console.error("public-enrollment error:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
