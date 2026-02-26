import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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
        const addE = (c: any) => {
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
                return `<tr><td style="border: 1px solid #ddd; padding: 8px;">${c.athlete1?.first_name} ${c.athlete1?.last_name} / ${c.athlete2?.first_name} ${c.athlete2?.last_name}</td><td style="border: 1px solid #ddd; padding: 8px;">${c.category} - ${c.class}</td></tr>`;
            }).join("");
            return `<h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 5px;">${title} (${data.length})</h2><table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;"><thead><tr><th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;">Coppia</th><th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;">Categoria</th></tr></thead><tbody>${rows}</tbody></table>`;
        };

        const html = `<h1>Report: ${competition.name}</h1><p>Data: ${new Date(competition.date).toLocaleDateString("it-IT")}</p>${genT("CONFERMATI & PAGATI", entries.filter(e => e.is_paid), true)}${genT("DA PAGARE", entries.filter(e => !e.is_paid && !isLate(e.created_at)), true)}${genT("IN RITARDO (MORA)", entries.filter(e => !e.is_paid && isLate(e.created_at)), true)}${genT("MANCANTI", missing, false)}`;

        if (!RESEND_API_KEY) return new Response(JSON.stringify({ success: true, recipients: Array.from(emailSet) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({ from: "Dance Manager <info@antigravity.it>", to: ["info@antigravity.it"], bcc: Array.from(emailSet), subject: `Report Iscrizioni: ${competition.name}`, html }),
        });

        const resData = await res.json();
        return new Response(JSON.stringify(resData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
        console.error("send-competition-report error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
