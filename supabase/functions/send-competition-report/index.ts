import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-competition-report: Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing backend configuration");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Verify Requester (Admin only)
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin role required");

    const { competitionId } = await req.json();
    if (!competitionId) throw new Error("Missing competitionId");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Fetch Data
    const [cRes, eRes, clRes, pRes] = await Promise.all([
      supabase.from("competitions").select("*").eq("id", competitionId).single(),
      supabase.from("competition_entries").select("*, couples (id, category, class, athlete1:athletes!couples_athlete1_id_fkey (id, first_name, last_name, responsabili), athlete2:athletes!couples_athlete2_id_fkey (id, first_name, last_name, responsabili), instructor:profiles!couples_instructor_id_fkey (id, email, full_name))").eq("competition_id", competitionId),
      supabase.from("couples").select("id, category, class, is_active, athlete1:athletes!couples_athlete1_id_fkey (id, first_name, last_name, responsabili), athlete2:athletes!couples_athlete2_id_fkey (id, first_name, last_name, responsabili), instructor:profiles!couples_instructor_id_fkey (id, email, full_name)").eq("is_active", true),
      supabase.from("profiles").select("full_name, email"),
    ]);

    if (cRes.error || !cRes.data) throw new Error("Competition not found");
    
    const competition = cRes.data;
    const entries = eRes.data || [];
    const profiles = pRes.data || [];
    const registeredIds = new Set(entries.map(e => e.couple_id));
    const missing = (clRes.data || []).filter(c => !registeredIds.has(c.id));

    const deadline = competition.late_fee_deadline ? new Date(competition.late_fee_deadline) : null;
    const isLate = (d: string) => deadline && new Date(d) > deadline;

    // 3. Build Email List
    const emailSet = new Set<string>();
    const addEmailsFromCouple = (c: any) => {
      if (c?.instructor?.email) emailSet.add(c.instructor.email);
      const resps = [...(c?.athlete1?.responsabili || []), ...(c?.athlete2?.responsabili || [])].filter(Boolean);
      resps.forEach(name => {
        const p = profiles.find(pr => pr.full_name.toLowerCase().trim() === name.toLowerCase().trim());
        if (p?.email) emailSet.add(p.email);
      });
    };

    entries.forEach(e => addEmailsFromCouple(e.couples));
    missing.forEach(c => addEmailsFromCouple(c));

    // 4. Generate HTML
    const generateTable = (title: string, data: any[], isEntry: boolean) => {
      if (!data.length) return `<p style="color: #94a3b8; font-style: italic;">Nessuna coppia.</p>`;
      const rows = data.map(item => {
        const c = isEntry ? item.couples : item;
        const name = `${c.athlete1?.first_name || ""} ${c.athlete1?.last_name || ""} / ${c.athlete2?.first_name || ""} ${c.athlete2?.last_name || ""}`;
        return `
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 12px; font-size: 14px;">${name}</td>
            <td style="border: 1px solid #e2e8f0; padding: 12px; font-size: 14px;">${c.category} - ${c.class}</td>
          </tr>`;
      }).join("");

      return `
        <h2 style="color: #1e293b; font-size: 18px; margin-top: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">${title} (${data.length})</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
              <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Coppia</th>
              <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Categoria</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #334155; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f1f5f9; }
          .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
          .header { text-align: center; margin-bottom: 40px; }
          .footer { text-align: center; margin-top: 40px; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; color: #0f172a; font-size: 24px;">Report Iscrizioni</h1>
            <p style="margin: 4px 0 0; color: #64748b;">${competition.name} • ${new Date(competition.date).toLocaleDateString("it-IT")}</p>
          </div>
          ${generateTable("CONFERMATI & PAGATI", entries.filter(e => e.is_paid), true)}
          ${generateTable("DA PAGARE", entries.filter(e => !e.is_paid && !isLate(e.created_at)), true)}
          ${generateTable("IN RITARDO (MORA)", entries.filter(e => !e.is_paid && isLate(e.created_at)), true)}
          ${generateTable("COPPIE NON ISCRITTE", missing, false)}
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Dance Manager • Ritmo Danza</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 5. Send Email
    if (brevoApiKey) {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoApiKey
        },
        body: JSON.stringify({
          sender: { name: "Dance Manager", email: "ufficiogare@ritmodanza.net" },
          to: [{ email: "info@antigravity.it" }],
          bcc: Array.from(emailSet).map(email => ({ email })),
          subject: `Report Iscrizioni: ${competition.name}`,
          htmlContent: html
        }),
      });

      if (!res.ok) {
        console.error(`[${requestId}] send-competition-report: Brevo error:`, await res.text());
        throw new Error("Failed to send email");
      }
    }

    console.log(`[${requestId}] send-competition-report: Success`);
    return new Response(JSON.stringify({ success: true, recipients: emailSet.size }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error(`[${requestId}] send-competition-report: Global error:`, error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
