import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const LOGO_BASE64 = `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`;

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        if (!supabaseUrl || !anonKey || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: "Missing configuration" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const authHeader = req.headers.get("Authorization") ?? "";
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const { data: isAdmin } = await userClient.rpc("has_role", {
            _user_id: user.id,
            _role: "admin",
        });

        if (!isAdmin) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { competitionId } = await req.json();
        if (!competitionId) throw new Error("Missing ID");

        const [cRes, eRes, clRes, pRes] = await Promise.all([
            supabase.from("competitions").select("*").eq("id", competitionId).single(),
            supabase.from("competition_entries").select("*, couples (id, category, class, athlete1:athletes!couples_athlete1_id_fkey (id, first_name, last_name, responsabili), athlete2:athletes!couples_athlete2_id_fkey (id, first_name, last_name, responsabili), instructor:profiles!couples_instructor_id_fkey (id, email, full_name))").eq("competition_id", competitionId),
            supabase.from("couples").select("id, category, class, is_active, athlete1:athletes!couples_athlete1_id_fkey (id, first_name, last_name, responsabili), athlete2:athletes!couples_athlete2_id_fkey (id, first_name, last_name, responsabili), instructor:profiles!couples_instructor_id_fkey (id, email, full_name)").eq("is_active", true),
            supabase.from("profiles").select("full_name, email"),
        ]);

        if (cRes.error || !cRes.data) throw new Error("Comp not found");
        const competition = cRes.data;
        const entries = eRes.data || [];
        const profiles = pRes.data || [];
        const registeredIds = new Set(entries.map(e => e.couple_id));
        const missing = (clRes.data || []).filter(c => !registeredIds.has(c.id));

        const deadline = competition.late_fee_deadline ? new Date(competition.late_fee_deadline) : null;
        const isLate = (d: string) => deadline && new Date(d) > deadline;

        const emailSet = new Set<string>();
        const addE = (c: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
            if (c?.instructor?.email) emailSet.add(c.instructor.email);
            [c?.athlete1?.responsabili, c?.athlete2?.responsabili].flat().forEach(name => {
                if (!name) return;
                const p = profiles.find(pr => pr.full_name.toLowerCase().trim() === name.toLowerCase().trim());
                if (p?.email) emailSet.add(p.email);
            });
        };
        [...entries.map(e => e.couples), ...missing].forEach(c => addE(c));

        const genT = (title: string, data: any[], isE: boolean) => {
            if (!data.length) return `<p>Nessuna coppia in questa categoria.</p>`;
            const rows = data.map(item => {
                const c = isE ? item.couples : item;
                const couplesNames = `${c.athlete1?.first_name || ""} ${c.athlete1?.last_name || ""} / ${c.athlete2?.first_name || ""} ${c.athlete2?.last_name || ""}`;
                return `<tr><td style="border: 1px solid #ddd; padding: 12px;">${couplesNames}</td><td style="border: 1px solid #ddd; padding: 12px;">${c.category} - ${c.class}</td></tr>`;
            }).join("");
            return `<h2 style="color: #2c333d; border-bottom: 2px solid #3f4752; padding-bottom: 5px; margin-top: 30px;">${title} (${data.length})</h2><table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;"><thead><tr><th style="border: 1px solid #ddd; padding: 12px; background-color: #f8fafc; text-align: left; color: #4a5568;">Coppia</th><th style="border: 1px solid #ddd; padding: 12px; background-color: #f8fafc; text-align: left; color: #4a5568;">Categoria</th></tr></thead><tbody>${rows}</tbody></table>`;
        };

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #4a5568; margin: 0; padding: 0; background-color: #f7fafc; }
              .container { max-width: 800px; margin: 30px auto; padding: 0; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
              .header { background-color: #2c333d; padding: 40px 20px; text-align: center; color: #ffffff; }
              .logo-circle { width: 125px; height: 125px; background-color: #3f4752; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; overflow: hidden; }
              .header-title { font-size: 32px; font-weight: 700; margin: 0 0 10px 0; color: #ffffff; }
              .header-subtitle { font-size: 14px; color: #cbd5e0; margin: 0; }
              .content { padding: 40px; }
              .footer { font-size: 12px; color: #a0aec0; text-align: center; padding: 30px; background-color: #edf2f7; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0; padding: 0;">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                        <tr>
                          <td align="center" valign="middle" width="125" height="125" style="width: 125px; height: 125px; background-color: #3f4752; border-radius: 50%;">
                            <img src="https://rd-dance-manager.vercel.app/logo-white.png" alt="Dance Manager Logo" width="100" style="display: block; width: 100px; height: auto; margin: 0 auto;">
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <h1 class="header-title">Report Iscrizioni</h1>
                <p class="header-subtitle">${competition.name} - ${new Date(competition.date).toLocaleDateString("it-IT")}</p>
              </div>
              <div class="content">
                ${genT("CONFERMATI & PAGATI", entries.filter(e => e.is_paid), true)}
                ${genT("DA PAGARE", entries.filter(e => !e.is_paid && !isLate(e.created_at)), true)}
                ${genT("IN RITARDO (MORA)", entries.filter(e => !e.is_paid && isLate(e.created_at)), true)}
                ${genT("MANCANTI", missing, false)}
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Ritmo Danza - Dance Manager System</p>
              </div>
            </div>
          </body>
          </html>
        `;

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
                subject: `Report Iscrizioni: ${competition.name}`,
                htmlContent: html
            }),
        });

        const resData = await res.json();
        return new Response(JSON.stringify(resData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
        console.error("send-competition-report error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
