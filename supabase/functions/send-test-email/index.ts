import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

        // Check auth
        const authHeader = req.headers.get("Authorization") ?? "";
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Non autorizzato" }), {
                status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        // Check admin role
        const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) {
            return new Response(JSON.stringify({ error: "Accesso negato" }), {
                status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        const { to } = await req.json();
        if (!to) {
            return new Response(JSON.stringify({ error: "Campo 'to' mancante" }), {
                status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        // Check if RESEND_API_KEY is configured
        if (!RESEND_API_KEY) {
            return new Response(JSON.stringify({
                success: false,
                error: "RESEND_API_KEY non configurata nei secrets della Edge Function. Vai su Supabase Dashboard → Edge Functions → Secrets e aggiungi RESEND_API_KEY."
            }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">✅ Test Email – Dance Manager</h2>
        <p>Questa è un'email di test per verificare che il sistema di notifiche funzioni correttamente.</p>
        <ul>
          <li>La chiave Resend API è configurata ✅</li>
          <li>Le email di iscrizione alle gare verranno inviate automaticamente ✅</li>
        </ul>
        <p style="color: #888; font-size: 12px;">Inviata da Dance Manager - ${new Date().toLocaleString("it-IT")}</p>
      </div>
    `;

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Dance Manager <info@antigravity.it>",
                to: [to],
                subject: "✅ Test Email – Dance Manager funziona!",
                html,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return new Response(JSON.stringify({ success: false, error: data?.message || "Errore Resend", detail: data }), {
                status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }

        return new Response(JSON.stringify({ success: true, id: data.id }), {
            status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });

    } catch (err: unknown) {
        console.error("send-test-email error:", err);
        return new Response(JSON.stringify({ success: false, error: (err instanceof Error ? err.message : String(err)) }), {
            status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
});
